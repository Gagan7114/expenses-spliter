from django.conf import settings
from django.db import models
from django.utils import timezone

from groups.models import Group, Membership


class Expense(models.Model):
    class Category(models.TextChoices):
        FOOD = "food", "Food & drinks"
        GROCERIES = "groceries", "Groceries"
        RENT = "rent", "Rent"
        UTILITIES = "utilities", "Utilities"
        TRAVEL = "travel", "Travel"
        STAY = "stay", "Stay"
        SHOPPING = "shopping", "Shopping"
        FUN = "fun", "Entertainment"
        OTHER = "other", "Other"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="expenses")
    description = models.CharField(max_length=120)
    amount_cents = models.BigIntegerField()
    paid_by = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="expenses_paid")
    date = models.DateField(default=timezone.localdate)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    split_type = models.CharField(max_length=10, default="equal")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["group", "date"])]
        constraints = [models.CheckConstraint(condition=models.Q(amount_cents__gt=0), name="expense_amount_positive")]


class ExpenseSplit(models.Model):
    """One person's share of an expense, in paise. Shares always sum to the expense amount."""

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="splits")
    member = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="splits")
    share_cents = models.BigIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["expense", "member"], name="unique_split")]


class Settlement(models.Model):
    """A recorded payment: `from_member` paid `to_member`."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="settlements")
    from_member = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="settlements_paid")
    to_member = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name="settlements_received")
    amount_cents = models.BigIntegerField()
    date = models.DateField(default=timezone.localdate)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount_cents__gt=0), name="settlement_amount_positive"),
            models.CheckConstraint(
                condition=~models.Q(from_member=models.F("to_member")), name="settlement_not_self"
            ),
        ]
