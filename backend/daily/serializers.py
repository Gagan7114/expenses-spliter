from decimal import Decimal

from rest_framework import serializers

from expenses.serializers import AmountField
from groups.models import Group, Membership

from .models import DailyItem

MAX_QUANTITY = Decimal("1000")


class QuantityField(serializers.DecimalField):
    def __init__(self, **kwargs):
        super().__init__(max_digits=7, decimal_places=2, min_value=Decimal("0"), max_value=MAX_QUANTITY, **kwargs)


class DailyItemSerializer(serializers.ModelSerializer):
    rate = AmountField(source="rate_cents", write_only=True)
    default_quantity = QuantityField()
    group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.none(), allow_null=True, required=False)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)
    created_by = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = DailyItem
        fields = [
            "id", "name", "unit", "default_quantity", "rate", "rate_cents", "start_date",
            "group", "group_name", "user", "created_by", "created_at",
        ]
        read_only_fields = ["rate_cents", "user", "created_at"]

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user is not None:
            # Items can only be shared with groups you're still in.
            self.fields["group"].queryset = Group.objects.filter(
                memberships__user=user, memberships__left_at__isnull=True
            )


class DayQuantitySerializer(serializers.Serializer):
    quantity = QuantityField()


class BillSerializer(serializers.Serializer):
    """Add one month of a group item to the group as an expense."""

    month = serializers.RegexField(r"^\d{4}-\d{2}$", error_messages={"invalid": "Use the format YYYY-MM."})
    paid_by = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none())
    participants = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none(), many=True, required=False)

    def __init__(self, *args, group, **kwargs):
        super().__init__(*args, **kwargs)
        active = Membership.objects.active().filter(group=group)
        self.fields["paid_by"].queryset = active
        self.fields["participants"].child_relation.queryset = active

    def validate_participants(self, value):
        if not value:
            raise serializers.ValidationError("Pick at least one person to split with.")
        return value
