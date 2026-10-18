from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from .models import Membership


def membership_or_404(user, group_id) -> Membership:
    """The user's active membership in a group. Non-members get 404, so
    group ids can't be probed."""
    return get_object_or_404(
        Membership.objects.active().select_related("group"), group_id=group_id, user=user
    )


def require_admin(membership: Membership):
    if membership.role != Membership.Role.ADMIN:
        raise PermissionDenied("Only group admins can do this.")
