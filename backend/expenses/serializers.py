from rest_framework import serializers

from groups.models import Membership

from .models import Expense, Settlement
from .services.money import InvalidAmount, to_cents

MAX_CENTS = 10**12  # ₹1,000 crore; guards against typos


class AmountField(serializers.Field):
    """Accepts '1234.50' (or a number) and stores integer paise."""

    def to_internal_value(self, data):
        try:
            cents = to_cents(data)
        except InvalidAmount as e:
            raise serializers.ValidationError(str(e))
        if cents <= 0:
            raise serializers.ValidationError("Amount must be more than zero.")
        if cents > MAX_CENTS:
            raise serializers.ValidationError("That amount is too large.")
        return cents

    def to_representation(self, value):
        return value


class ExpenseSerializer(serializers.ModelSerializer):
    amount = AmountField(source="amount_cents", write_only=True)
    paid_by = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none())
    participants = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.none(), many=True, write_only=True
    )
    splits = serializers.SerializerMethodField()
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id", "description", "amount", "amount_cents", "paid_by", "participants", "splits",
            "date", "category", "split_type", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["amount_cents", "split_type", "created_at", "updated_at"]

    def __init__(self, *args, group=None, **kwargs):
        super().__init__(*args, **kwargs)
        if group is not None:
            # Only active members of this group can pay or share new expenses.
            active = Membership.objects.active().filter(group=group)
            self.fields["paid_by"].queryset = active
            self.fields["participants"].child_relation.queryset = active

    def get_splits(self, obj):
        return [{"member": s.member_id, "share_cents": s.share_cents} for s in obj.splits.all()]

    def validate_participants(self, value):
        if not value:
            raise serializers.ValidationError("Pick at least one person to split with.")
        return value


class SettlementSerializer(serializers.ModelSerializer):
    amount = AmountField(source="amount_cents", write_only=True)
    from_member = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none())
    to_member = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none())
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Settlement
        fields = ["id", "from_member", "to_member", "amount", "amount_cents", "date", "created_by", "created_at"]
        read_only_fields = ["amount_cents", "created_at"]

    def __init__(self, *args, group=None, **kwargs):
        super().__init__(*args, **kwargs)
        if group is not None:
            # Former members can still pay or be paid what they owe.
            members = Membership.objects.filter(group=group)
            self.fields["from_member"].queryset = members
            self.fields["to_member"].queryset = members

    def validate(self, attrs):
        if attrs["from_member"] == attrs["to_member"]:
            raise serializers.ValidationError({"to_member": "Someone can't pay themselves."})
        return attrs
