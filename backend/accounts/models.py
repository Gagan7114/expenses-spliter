from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import RegexValidator
from django.db import models

user_id_validator = RegexValidator(
    r"^[a-z0-9_]{3,20}$",
    "User ID must be 3–20 characters: letters, numbers and underscore.",
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

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    objects = SplitterUserManager()

    def save(self, *args, **kwargs):
        self.username = self.username.lower()
        self.email = self.email.lower()
        if not self.display_name:
            self.display_name = self.username
        super().save(*args, **kwargs)

    def __str__(self):
        return f"@{self.username}"
