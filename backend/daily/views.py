import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from expenses.models import Expense
from expenses.views import _save_splits
from groups.models import Membership

from .models import DailyBill, DailyEntry, DailyItem
from .serializers import BillSerializer, DailyItemSerializer, DayQuantitySerializer


def _month_bounds(value: str | None) -> tuple[date, date]:
    """'2026-10' -> (Oct 1, Oct 31). Defaults to the current month."""
    today = timezone.localdate()
    if not value:
        year, month = today.year, today.month
    else:
        try:
            year, month = (int(p) for p in value.split("-"))
            date(year, month, 1)
        except ValueError:
            raise ValidationError({"month": "Use the format YYYY-MM."})
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def month_summary(item: DailyItem, first: date, last: date) -> dict:
    """Every day of the month: its quantity (default unless overridden) and cost.
    Days before the item started or after today don't count."""
    today = timezone.localdate()
    overrides = {e.date: e.quantity for e in item.entries.filter(date__range=(first, last))}
    days, total_qty, total_cents, delivered, skipped, extra = [], Decimal(0), 0, 0, 0, 0
    day = first
    while day <= last:
        if day < item.start_date or day > today:
            days.append({"date": day, "status": "future" if day > today else "inactive", "quantity": None, "amount_cents": 0})
        else:
            qty = overrides.get(day, item.default_quantity)
            cents = item.cost_cents(qty)
            if day not in overrides:
                state = "default"
            elif qty == 0:
                state = "skipped"
            else:
                state = "changed"
            days.append({"date": day, "status": state, "quantity": qty, "amount_cents": cents})
            total_qty += qty
            total_cents += cents
            delivered += qty > 0
            skipped += qty == 0
            extra += state == "changed"
        day += timedelta(days=1)
    return {
        "month": first.strftime("%Y-%m"),
        "days": days,
        "total_quantity": total_qty,
        "total_cents": total_cents,
        "delivered_days": delivered,
        "skipped_days": skipped,
        "changed_days": extra,
    }


def _visible_items(user):
    """My personal items, plus the items of every group I'm still in."""
    my_groups = Membership.objects.active().filter(user=user).values("group_id")
    return DailyItem.objects.filter(
        Q(user=user, group__isnull=True) | Q(group__in=my_groups)
    ).select_related("group", "user")


def _item_or_404(request, item_id) -> DailyItem:
    return get_object_or_404(_visible_items(request.user), pk=item_id)


def _bill_info(item: DailyItem, first: date, total_cents: int):
    bill = item.bills.select_related("expense").filter(month=first).first()
    if not bill:
        return None
    e = bill.expense
    return {"expense_id": e.id, "amount_cents": e.amount_cents, "paid_by": e.paid_by_id, "up_to_date": e.amount_cents == total_cents}


@api_view(["GET", "POST"])
def items(request):
    if request.method == "POST":
        serializer = DailyItemSerializer(data=request.data, user=request.user)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    first, last = _month_bounds(None)
    result = []
    for item in _visible_items(request.user):
        summary = month_summary(item, first, last)
        result.append({
            **DailyItemSerializer(item).data,
            "this_month": {k: summary[k] for k in ("month", "total_quantity", "total_cents", "delivered_days", "skipped_days")},
        })
    return Response(result)


@api_view(["GET", "PATCH", "DELETE"])
def item_detail(request, item_id):
    item = _item_or_404(request, item_id)
    if request.method == "DELETE":
        if item.user_id != request.user.id:
            raise PermissionDenied(f"Only {item.user.display_name} can delete this item.")
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        serializer = DailyItemSerializer(item, data=request.data, partial=True, user=request.user)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(DailyItemSerializer(item).data)


@api_view(["GET"])
def item_month(request, item_id):
    item = _item_or_404(request, item_id)
    first, last = _month_bounds(request.query_params.get("month"))
    summary = month_summary(item, first, last)
    return Response({
        "item": DailyItemSerializer(item).data, **summary,
        "bill": _bill_info(item, first, summary["total_cents"]) if item.group_id else None,
    })


@api_view(["PUT", "DELETE"])
def item_day(request, item_id, day):
    """PUT {quantity} sets one day (0 = skipped). DELETE goes back to the default."""
    item = _item_or_404(request, item_id)
    try:
        when = date.fromisoformat(day)
    except ValueError:
        raise ValidationError({"date": "Use the format YYYY-MM-DD."})
    if request.method == "DELETE":
        item.entries.filter(date=when).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if when > timezone.localdate():
        raise ValidationError({"date": "You can't change a day that hasn't happened yet."})
    if when < item.start_date:
        raise ValidationError({"date": "That day is before you started tracking this item."})
    serializer = DayQuantitySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    qty = serializer.validated_data["quantity"]
    if qty == item.default_quantity:
        item.entries.filter(date=when).delete()
    else:
        DailyEntry.objects.update_or_create(item=item, date=when, defaults={"quantity": qty})
    return Response({"date": when, "quantity": qty})


@api_view(["POST"])
def item_bill(request, item_id):
    """Add (or update) one month of a group item as a group expense, split equally."""
    item = _item_or_404(request, item_id)
    if not item.group_id:
        raise ValidationError({"detail": "Share this item with a group first."})
    serializer = BillSerializer(data=request.data, group=item.group)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    first, last = _month_bounds(data["month"])
    today = timezone.localdate()
    if first > today:
        raise ValidationError({"month": "That month hasn't started yet."})
    total = month_summary(item, first, last)["total_cents"]
    if total <= 0:
        raise ValidationError({"detail": "Nothing to add: this month's total is zero."})
    participants = data.get("participants") or list(Membership.objects.active().filter(group=item.group))
    description = f"{item.name} – {first.strftime('%B %Y')}"[:120]

    with transaction.atomic():
        bill = item.bills.select_related("expense").filter(month=first).first()
        if bill:
            expense = bill.expense
            expense.amount_cents, expense.paid_by, expense.description = total, data["paid_by"], description
            expense.save()
        else:
            expense = Expense.objects.create(
                group=item.group, description=description, amount_cents=total, paid_by=data["paid_by"],
                date=min(last, today), category=Expense.Category.GROCERIES, created_by=request.user,
            )
            DailyBill.objects.create(item=item, month=first, expense=expense)
        _save_splits(expense, participants)
    return Response(_bill_info(item, first, total), status=status.HTTP_200_OK if bill else status.HTTP_201_CREATED)
