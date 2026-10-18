from django.conf import settings
from rest_framework import serializers

from accounts.serializers import PublicUserSerializer

from .models import Group, Invite, Membership


class MembershipSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "joined_at", "left_at", "is_active"]


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["id", "name", "type", "currency", "created_at"]

    def validate_currency(self, value):
        value = value.upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Use a 3-letter currency code like INR.")
        return value


class InviteSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    invited_user = PublicUserSerializer(read_only=True)
    created_by = PublicUserSerializer(read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Invite
        fields = ["id", "kind", "code", "url", "status", "expires_at", "group", "invited_user", "created_by", "created_at"]

    def get_url(self, obj):
        return f"{settings.FRONTEND_URL}/join/{obj.code}"
