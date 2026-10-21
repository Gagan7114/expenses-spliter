from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from expenses.models import Expense
from groups.models import Group


class DailyItem(models.Model):
    """Something delivered every day, like milk. Each day counts as
    `default_quantity` unless a DailyEntry says otherwise.

    Personal items belong to `user` alone. With a `group`, every active member
    can see and mark days, and the month's bill can be added as a group expense."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_items")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="daily_items")
    name = models.CharField(max_length=60)
    unit = models.CharField(max_length=12, default="L")
    default_quantity = models.DecimalField(max_digits=7, decimal_places=2)
    rate_cents = models.BigIntegerField(help_text="Price per unit, in paise.")
    start_date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(rate_cents__gt=0), name="daily_rate_positive"),
            models.CheckConstraint(condition=models.Q(default_quantity__gte=0), name="daily_default_qty_nonneg"),
        ]

    def cost_cents(self, quantity: Decimal) -> int:
        return int((quantity * self.rate_cents).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def __str__(self):
        return self.name


class DailyEntry(models.Model):
    """A day that differs from the default. Quantity 0 means skipped."""

    item = models.ForeignKey(DailyItem, on_delete=models.CASCADE, related_name="entries")
    date = models.DateField()
    quantity = models.DecimalField(max_digits=7, decimal_places=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["item", "date"], name="unique_daily_entry"),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="daily_entry_qty_nonneg"),
        ]


class DailyBill(models.Model):
    """The group expense a month of this item was added as, so adding it
    again updates that expense instead of creating a duplicate."""

    item = models.ForeignKey(DailyItem, on_delete=models.CASCADE, related_name="bills")
    month = models.DateField(help_text="First day of the month.")
    expense = models.OneToOneField(Expense, on_delete=models.CASCADE, related_name="daily_bill")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["item", "month"], name="unique_daily_bill")]
