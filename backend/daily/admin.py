from django.contrib import admin

from .models import DailyEntry, DailyItem


class EntryInline(admin.TabularInline):
    model = DailyEntry
    extra = 0


@admin.register(DailyItem)
class DailyItemAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "default_quantity", "unit", "rate_cents", "start_date"]
    inlines = [EntryInline]
