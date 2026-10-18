from django.contrib import admin

from .models import Expense, ExpenseSplit, Settlement


class SplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ["description", "group", "amount_cents", "paid_by", "date"]
    list_filter = ["group"]
    inlines = [SplitInline]


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ["group", "from_member", "to_member", "amount_cents", "date"]
