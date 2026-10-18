from collections import defaultdict


def compute_balances(expenses, settlements) -> dict:
    """Net balance per member id: paid - owed (+ = is owed money, - = owes money).

    expenses:    iterable of (payer_id, amount_cents, {member_id: share_cents})
    settlements: iterable of (from_id, to_id, amount_cents)  # from paid to
    """
    bal = defaultdict(int)
    for payer, amount, shares in expenses:
        bal[payer] += amount
        for member, share in shares.items():
            bal[member] -= share
    for frm, to, amount in settlements:
        bal[frm] += amount
        bal[to] -= amount
    return dict(bal)
