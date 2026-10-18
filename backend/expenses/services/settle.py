"""Turn net balances into the fewest payments that settle everyone.

Greedy: biggest debtor pays biggest creditor, repeat. At most n-1 payments.
Optimal: a set of k people whose balances sum to zero can settle among
themselves in k-1 payments, so the minimum is
    (people with nonzero balance) - (most disjoint zero-sum subgroups).
Found with a bitmask DP over subsets; used up to OPTIMAL_LIMIT people.
"""
from typing import NamedTuple

OPTIMAL_LIMIT = 16


class Payment(NamedTuple):
    frm: object
    to: object
    amount: int


def greedy(balances: dict) -> list[Payment]:
    bal = {k: v for k, v in balances.items() if v != 0}
    if sum(bal.values()) != 0:
        raise ValueError("Balances must sum to zero.")
    payments = []
    while bal:
        # Ties broken by id so the result is repeatable.
        creditor = max(bal, key=lambda k: (bal[k], _key(k)))
        debtor = min(bal, key=lambda k: (bal[k], _key(k)))
        amount = min(bal[creditor], -bal[debtor])
        payments.append(Payment(debtor, creditor, amount))
        bal[creditor] -= amount
        bal[debtor] += amount
        for k in (creditor, debtor):
            if bal[k] == 0:
                del bal[k]
    return payments


def optimal(balances: dict) -> list[Payment]:
    people = sorted((k for k, v in balances.items() if v != 0), key=_key)
    k = len(people)
    if k > OPTIMAL_LIMIT:
        return greedy(balances)
    if sum(balances[p] for p in people) != 0:
        raise ValueError("Balances must sum to zero.")
    if k == 0:
        return []

    full = (1 << k) - 1
    total = [0] * (full + 1)
    dp = [0] * (full + 1)
    for mask in range(1, full + 1):
        low = (mask & -mask).bit_length() - 1
        total[mask] = total[mask & (mask - 1)] + balances[people[low]]
        best = 0
        m = mask
        while m:
            bit = m & -m
            best = max(best, dp[mask ^ bit])
            m ^= bit
        dp[mask] = best + (1 if total[mask] == 0 else 0)

    # Walk back from the full set, removing one person at a time along an
    # optimal path. Every zero-sum mask on that path closes one subgroup.
    groups, current, mask = [], [], full
    while mask:
        need = dp[mask] - (1 if total[mask] == 0 else 0)
        m = mask
        while m:
            bit = m & -m
            if dp[mask ^ bit] == need:
                break
            m ^= bit
        current.append(people[bit.bit_length() - 1])
        mask ^= bit
        if total[mask] == 0:
            groups.append(current)
            current = []

    payments = []
    for g in groups:
        payments.extend(greedy({p: balances[p] for p in g}))
    return payments


def _key(k):
    return (str(type(k)), k)
