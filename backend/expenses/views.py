from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from groups.access import membership_or_404
from groups.models import Membership

from .ledger import group_balances, settle_plan
from .models import Expense, ExpenseSplit, Settlement
from .serializers import ExpenseSerializer, SettlementSerializer
from .services.splits import equal_split


def _save_splits(expense, participants):
    shares = equal_split(expense.amount_cents, [m.id for m in participants])
    expense.splits.all().delete()
    ExpenseSplit.objects.bulk_create(
        ExpenseSplit(expense=expense, member_id=mid, share_cents=cents) for mid, cents in shares.items()
    )


@api_view(["GET", "POST"])
def expenses(request, group_id):
    membership = membership_or_404(request.user, group_id)
    group = membership.group
    if request.method == "POST":
        serializer = ExpenseSerializer(data=request.data, group=group)
        serializer.is_valid(raise_exception=True)
        participants = serializer.validated_data.pop("participants")
        with transaction.atomic():
            expense = serializer.save(group=group, created_by=request.user)
            _save_splits(expense, participants)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

    qs = group.expenses.prefetch_related("splits").select_related("created_by")
    return Response(ExpenseSerializer(qs, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
def expense_detail(request, expense_id):
    expense = get_object_or_404(Expense, pk=expense_id)
    membership_or_404(request.user, expense.group_id)
    if request.method == "DELETE":
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        serializer = ExpenseSerializer(expense, data=request.data, partial=True, group=expense.group)
        serializer.is_valid(raise_exception=True)
        participants = serializer.validated_data.pop("participants", None)
        with transaction.atomic():
            expense = serializer.save()
            if participants is None and "amount_cents" in serializer.validated_data:
                participants = [s.member for s in expense.splits.select_related("member")]
            if participants is not None:
                _save_splits(expense, participants)
    return Response(ExpenseSerializer(expense).data)


@api_view(["GET"])
def balances(request, group_id):
    membership = membership_or_404(request.user, group_id)
    return Response({str(k): v for k, v in group_balances(membership.group).items()})


@api_view(["GET"])
def settle(request, group_id):
    membership = membership_or_404(request.user, group_id)
    return Response(settle_plan(membership.group))


@api_view(["GET", "POST"])
def settlements(request, group_id):
    membership = membership_or_404(request.user, group_id)
    group = membership.group
    if request.method == "POST":
        serializer = SettlementSerializer(data=request.data, group=group)
        serializer.is_valid(raise_exception=True)
        serializer.save(group=group, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(SettlementSerializer(group.settlements.select_related("created_by"), many=True).data)


@api_view(["DELETE"])
def settlement_detail(request, settlement_id):
    settlement = get_object_or_404(Settlement, pk=settlement_id)
    membership_or_404(request.user, settlement.group_id)
    settlement.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _people(group):
    return {
        m.id: {
            "id": m.id, "name": m.user.display_name, "username": m.user.username,
            "upi_id": m.user.upi_id, "is_active": m.is_active,
        }
        for m in group.memberships.select_related("user")
    }


def _group_info(group, membership):
    return {"id": group.id, "name": group.name, "type": group.type, "currency": group.currency, "my_membership_id": membership.id}


@api_view(["GET"])
def activity(request):
    """Expenses and payments across all my groups, newest first. Optional ?group=<id>."""
    memberships = Membership.objects.active().filter(user=request.user).select_related("group")
    group_filter = request.query_params.get("group")
    if group_filter:
        memberships = memberships.filter(group_id=group_filter)
    items = []
    for m in memberships:
        g = m.group
        people = _people(g)
        info = _group_info(g, m)
        for e in g.expenses.prefetch_related("splits"):
            items.append({
                "kind": "expense", "id": e.id, "group": info, "description": e.description,
                "amount_cents": e.amount_cents, "category": e.category, "date": e.date, "created_at": e.created_at,
                "paid_by": people[e.paid_by_id],
                "my_share_cents": next((s.share_cents for s in e.splits.all() if s.member_id == m.id), 0),
                "split_count": len(e.splits.all()),
            })
        for s in g.settlements.all():
            items.append({
                "kind": "payment", "id": s.id, "group": info, "amount_cents": s.amount_cents,
                "date": s.date, "created_at": s.created_at,
                "from": people[s.from_member_id], "to": people[s.to_member_id],
            })
    items.sort(key=lambda i: (i["date"], i["created_at"]), reverse=True)
    return Response(items)


@api_view(["GET"])
def pending(request):
    """The fewest-payments plan for every group I'm in that isn't settled."""
    result = []
    for m in Membership.objects.active().filter(user=request.user).select_related("group").order_by("group__name"):
        plan = settle_plan(m.group)
        if not plan["payments"]:
            continue
        people = _people(m.group)
        result.append({
            "group": _group_info(m.group, m),
            "optimal_count": plan["optimal_count"],
            "greedy_count": plan["greedy_count"],
            "payments": [
                {"from": people[p["from"]], "to": people[p["to"]], "amount_cents": p["amount_cents"]}
                for p in plan["payments"]
            ],
        })
    return Response(result)
