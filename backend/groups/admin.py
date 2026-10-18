from django.contrib import admin

from .models import Group, Invite, Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ["name", "type", "currency", "created_by", "created_at"]
    inlines = [MembershipInline]


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ["code", "group", "kind", "invited_user", "status", "expires_at", "uses"]
