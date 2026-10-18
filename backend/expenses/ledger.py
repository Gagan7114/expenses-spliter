"""Database-facing helpers: load a group's ledger and run the pure services on it."""
from collections import defaultdict

from .models import Expense, ExpenseSplit, Settlement
from .services.balances import compute_balances
from .services.settle import greedy, optimal


def group_balances(group) -> dict:
    """Balance in paise for every membership that ever took part, keyed by membership id."""
    shares = defaultdict(dict)
    for s in ExpenseSplit.objects.filter(expense__group=group).values("expense_id", "member_id", "share_cents"):
        shares[s["expense_id"]][s["member_id"]] = s["share_cents"]
    expenses = [
        (e["paid_by_id"], e["amount_cents"], shares[e["id"]])
        for e in Expense.objects.filter(group=group).values("id", "paid_by_id", "amount_cents")
    ]
    settlements = Settlement.objects.filter(group=group).values_list("from_member_id", "to_member_id", "amount_cents")
    balances = compute_balances(expenses, settlements)
    for m in group.memberships.all():
        balances.setdefault(m.id, 0)
    return balances


def settle_plan(group) -> dict:
    balances = group_balances(group)
    best = optimal(balances)
    return {
        "payments": [{"from": p.frm, "to": p.to, "amount_cents": p.amount} for p in best],
        "optimal_count": len(best),
        "greedy_count": len(greedy(balances)),
        "expense_count": Expense.objects.filter(group=group).count(),
    }
