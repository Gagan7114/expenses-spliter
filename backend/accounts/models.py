import re

from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import RegexValidator
from django.db import models

user_id_validator = RegexValidator(
    r"^[a-z0-9_]{3,20}$",
    "User ID must be 3–20 characters: letters, numbers and underscore.",
)
upi_id_validator = RegexValidator(
    r"^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$",
    "Enter a UPI ID like name@okhdfcbank.",
    flags=re.IGNORECASE,
)


class SplitterUserManager(UserManager):
    def get_by_natural_key(self, username):
        return self.get(username=username.lower())


class User(AbstractUser):
    """`username` is the public user ID people search and invite by (e.g. @jashan).

    User IDs and emails are stored lowercase, so uniqueness is case-insensitive.
    """

    username = models.CharField(max_length=20, unique=True, validators=[user_id_validator])
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=60)
    # Shown to people in the user's groups so they can pay them by UPI.
    upi_id = models.CharField(max_length=100, blank=True, validators=[upi_id_validator])

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    objects = SplitterUserManager()

    def save(self, *args, **kwargs):
        self.username = self.username.lower()
        self.email = self.email.lower()
        self.upi_id = self.upi_id.strip().lower()
        if not self.display_name:
            self.display_name = self.username
        super().save(*args, **kwargs)

    def __str__(self):
        return f"@{self.username}"
