from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class SplitterUserAdmin(UserAdmin):
    list_display = ["username", "display_name", "email", "date_joined"]
    fieldsets = UserAdmin.fieldsets + (("Profile", {"fields": ["display_name"]}),)
