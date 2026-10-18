import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

# No 0/O/1/I so codes are easy to read aloud and type.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_LINK_DAYS = 7


def new_invite_code():
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


class Group(models.Model):
    class Type(models.TextChoices):
        TRIP = "trip", "Trip"
        HOUSEHOLD = "household", "Household"
        OTHER = "other", "Other"

    name = models.CharField(max_length=80)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.TRIP)
    currency = models.CharField(max_length=3, default="INR")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class MembershipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(left_at__isnull=True)


class Membership(models.Model):
    """A user's place in one group. Expenses point here, not at the user,
    so leaving or being removed keeps the group's history intact."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(default=timezone.now)
    left_at = models.DateTimeField(null=True, blank=True)

    objects = MembershipQuerySet.as_manager()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["group", "user"], name="unique_membership")]
        indexes = [models.Index(fields=["user"])]

    @property
    def is_active(self):
        return self.left_at is None

    def __str__(self):
        return f"{self.user} in {self.group}"


class Invite(models.Model):
    class Kind(models.TextChoices):
        LINK = "link", "Link"
        DIRECT = "direct", "Direct"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        REVOKED = "revoked", "Revoked"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="invites")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    code = models.CharField(max_length=6, unique=True, default=new_invite_code)
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="invites_received"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    uses = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def current_link(cls, group, user):
        """The group's active invite link, creating one if needed."""
        invite = (
            cls.objects.filter(group=group, kind=cls.Kind.LINK, status=cls.Status.PENDING)
            .filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now()))
            .first()
        )
        if invite:
            return invite
        return cls.objects.create(
            group=group, created_by=user, kind=cls.Kind.LINK,
            expires_at=timezone.now() + timedelta(days=INVITE_LINK_DAYS),
        )

    @property
    def is_usable(self):
        if self.status != self.Status.PENDING:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()
