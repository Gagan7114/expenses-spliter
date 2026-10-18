from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from accounts.models import User
from expenses.ledger import group_balances

from .access import membership_or_404, require_admin
from .models import Group, Invite, Membership
from .serializers import GroupSerializer, InviteSerializer, MembershipSerializer


def group_payload(group, membership):
    balances = group_balances(group)
    members = group.memberships.select_related("user").order_by("joined_at")
    data = GroupSerializer(group).data
    data.update(
        my_membership_id=membership.id,
        my_role=membership.role,
        my_balance_cents=balances.get(membership.id, 0),
        members=[
            {**MembershipSerializer(m).data, "balance_cents": balances.get(m.id, 0)}
            # Former members are included so old expenses can still show their names.
            for m in members
        ],
    )
    return data


@api_view(["GET", "POST"])
def groups(request):
    if request.method == "POST":
        serializer = GroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            group = serializer.save(created_by=request.user)
            membership = Membership.objects.create(group=group, user=request.user, role=Membership.Role.ADMIN)
        return Response(group_payload(group, membership), status=status.HTTP_201_CREATED)

    result = []
    for m in Membership.objects.active().filter(user=request.user).select_related("group").order_by("-group__created_at"):
        data = GroupSerializer(m.group).data
        data.update(
            my_balance_cents=group_balances(m.group).get(m.id, 0),
            member_count=m.group.memberships.active().count(),
        )
        result.append(data)
    return Response(result)


@api_view(["GET", "PATCH", "DELETE"])
def group_detail(request, group_id):
    membership = membership_or_404(request.user, group_id)
    group = membership.group
    if request.method == "PATCH":
        require_admin(membership)
        serializer = GroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    elif request.method == "DELETE":
        require_admin(membership)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(group_payload(group, membership))


@api_view(["PATCH", "DELETE"])
def member_detail(request, group_id, member_id):
    me = membership_or_404(request.user, group_id)
    target = get_object_or_404(Membership.objects.active(), pk=member_id, group_id=group_id)
    group = me.group
    admins = group.memberships.active().filter(role=Membership.Role.ADMIN)

    if request.method == "PATCH":
        require_admin(me)
        role = request.data.get("role")
        if role not in Membership.Role.values:
            raise ValidationError({"role": "Role must be admin or member."})
        if role == Membership.Role.MEMBER and target.role == Membership.Role.ADMIN and admins.count() == 1:
            raise ValidationError({"detail": "A group needs at least one admin. Make someone else admin first."})
        target.role = role
        target.save(update_fields=["role"])
        return Response(MembershipSerializer(target).data)

    leaving = target.pk == me.pk
    if not leaving:
        require_admin(me)
    elif group_balances(group).get(me.pk, 0) != 0:
        raise ValidationError({"detail": "Settle up before leaving: your balance in this group isn't zero."})
    if target.role == Membership.Role.ADMIN and admins.count() == 1 and group.memberships.active().count() > 1:
        raise ValidationError({"detail": "You're the only admin. Make someone else admin before leaving."})
    target.left_at = timezone.now()
    target.save(update_fields=["left_at"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def invite_link(request, group_id):
    membership = membership_or_404(request.user, group_id)
    return Response(InviteSerializer(Invite.current_link(membership.group, request.user)).data)


@api_view(["POST"])
def reset_invite_link(request, group_id):
    membership = membership_or_404(request.user, group_id)
    require_admin(membership)
    Invite.objects.filter(group=membership.group, kind=Invite.Kind.LINK, status=Invite.Status.PENDING).update(
        status=Invite.Status.REVOKED
    )
    return Response(InviteSerializer(Invite.current_link(membership.group, request.user)).data)


@api_view(["GET", "POST"])
def direct_invites(request, group_id):
    membership = membership_or_404(request.user, group_id)
    group = membership.group
    if request.method == "POST":
        username = str(request.data.get("username", "")).strip().lower().lstrip("@")
        user = User.objects.filter(username=username).first()
        if not user:
            raise ValidationError({"username": f"No one has the user ID @{username}."})
        if group.memberships.active().filter(user=user).exists():
            raise ValidationError({"username": f"@{username} is already in this group."})
        invite, _ = Invite.objects.get_or_create(
            group=group, kind=Invite.Kind.DIRECT, invited_user=user, status=Invite.Status.PENDING,
            defaults={"created_by": request.user},
        )
        return Response(InviteSerializer(invite).data, status=status.HTTP_201_CREATED)
    pending = group.invites.filter(kind=Invite.Kind.DIRECT, status=Invite.Status.PENDING).select_related("invited_user")
    return Response(InviteSerializer(pending, many=True).data)


@api_view(["GET"])
def my_invites(request):
    pending = Invite.objects.filter(
        invited_user=request.user, kind=Invite.Kind.DIRECT, status=Invite.Status.PENDING
    ).select_related("group", "created_by")
    return Response(InviteSerializer(pending, many=True).data)


def _join(group, user) -> Membership:
    existing = Membership.objects.filter(group=group, user=user).first()
    if existing:
        if not existing.is_active:
            # Rejoining starts a fresh join date; old expenses stay with the old record's history.
            existing.left_at = None
            existing.joined_at = timezone.now()
            existing.role = Membership.Role.MEMBER
            existing.save(update_fields=["left_at", "joined_at", "role"])
        return existing
    return Membership.objects.create(group=group, user=user)


@api_view(["POST"])
def respond_invite(request, invite_id, action):
    if action not in ("accept", "decline"):
        raise NotFound()
    invite = get_object_or_404(Invite, pk=invite_id, invited_user=request.user, kind=Invite.Kind.DIRECT)
    if invite.status != Invite.Status.PENDING:
        raise ValidationError({"detail": "This invite was already answered or cancelled."})
    with transaction.atomic():
        if action == "accept":
            _join(invite.group, request.user)
            invite.status = Invite.Status.ACCEPTED
        else:
            invite.status = Invite.Status.DECLINED
        invite.save(update_fields=["status"])
    return Response({"group_id": invite.group_id, "status": invite.status})


@api_view(["GET", "POST"])
def join(request, code):
    invite = Invite.objects.filter(code=code.strip().upper(), kind=Invite.Kind.LINK).select_related("group").first()
    if not invite:
        raise NotFound("This invite code doesn't exist. Check the code or ask for a new link.")
    group = invite.group
    already = group.memberships.active().filter(user=request.user).exists()
    if not invite.is_usable and not already:
        raise ValidationError({"detail": "This invite has expired. Ask a group member for a new link."})

    if request.method == "GET":
        return Response({
            "group": GroupSerializer(group).data,
            "member_count": group.memberships.active().count(),
            "already_member": already,
        })

    with transaction.atomic():
        if not already:
            _join(group, request.user)
            Invite.objects.filter(pk=invite.pk).update(uses=invite.uses + 1)
    return Response({"group_id": group.id})
