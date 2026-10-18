from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User, user_id_validator


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name"]


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name", "email"]
        read_only_fields = ["id", "email"]

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
