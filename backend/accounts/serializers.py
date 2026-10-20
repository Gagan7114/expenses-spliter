from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import User, upi_id_validator, user_id_validator


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name"]


class MemberUserSerializer(PublicUserSerializer):
    """A user as seen by people in their groups: includes the UPI ID to pay them."""

    class Meta(PublicUserSerializer.Meta):
        fields = PublicUserSerializer.Meta.fields + ["upi_id"]


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name", "email", "upi_id"]
        read_only_fields = ["id", "email"]

    def validate_upi_id(self, value):
        value = value.strip().lower()
        if value:
            upi_id_validator(value)
        return value

    def validate_username(self, value):
        value = value.lower()
        user_id_validator(value)
        if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("That user ID is taken.")
        return value


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    display_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        value = value.lower()
        user_id_validator(value)
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("That user ID is taken.")
        return value

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(
                attrs["password"], User(username=attrs["username"], email=attrs["email"])
            )
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs

    def create(self, data):
        return User.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=data["password"],
            display_name=data.get("display_name") or data["username"],
        )


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(attrs["uid"])))
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
        if not user or not user.is_active or not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"detail": "This reset link is invalid or has expired."})
        try:
            password_validation.validate_password(attrs["password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        return user
