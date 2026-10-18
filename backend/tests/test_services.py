from itertools import permutations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from expenses.services.balances import compute_balances
from expenses.services.money import InvalidAmount, split_evenly, to_cents
from expenses.services.settle import greedy, optimal
from expenses.services.splits import equal_split


def apply(balances, payments):
    bal = dict(balances)
    for p in payments:
        assert p.amount > 0
        bal[p.frm] += p.amount
        bal[p.to] -= p.amount
    return bal


def brute_force_min(balances):
    """Minimum payments by trying every ordering: n - (max zero-sum prefixes)."""
    people = [k for k, v in balances.items() if v]
    best = 0
    for order in permutations(people):
        run, count = 0, 0
        for p in order:
            run += balances[p]
            count += run == 0
        best = max(best, count)
    return len(people) - best


class TestMoney:
    @pytest.mark.parametrize("raw,cents", [("100", 10000), ("12.5", 1250), ("0.01", 1), ("1,250.75", 125075)])
    def test_to_cents(self, raw, cents):
        assert to_cents(raw) == cents

    @pytest.mark.parametrize("raw", ["abc", "1.234", "", "NaN", "inf"])
    def test_to_cents_rejects(self, raw):
        with pytest.raises(InvalidAmount):
            to_cents(raw)

    def test_split_evenly_gives_extra_paise_to_first(self):
        assert split_evenly(10000, 3) == [3334, 3333, 3333]

    @given(st.integers(1, 10**9), st.integers(1, 50))
    def test_split_evenly_sums_exactly(self, total, n):
        parts = split_evenly(total, n)
        assert sum(parts) == total and max(parts) - min(parts) <= 1

    def test_equal_split_is_repeatable(self):
        assert equal_split(1000, [9, 3, 5]) == {3: 334, 5: 333, 9: 333}


class TestSettle:
    def test_worked_example_from_plan(self):
        bal = {"A": 1500, "B": -1500, "C": 500, "D": -500}
        payments = optimal(bal)
        assert len(payments) == 2
        assert all(v == 0 for v in apply(bal, payments).values())

    def test_optimal_beats_greedy(self):
        # Greedy pairs the biggest amounts first and needs 5; {B,F} and {A,C,D,E} settle in 1 + 3 = 4.
        bal = {"A": -9, "B": 7, "C": -2, "D": 5, "E": 6, "F": -7}
        assert len(greedy(bal)) == 5
        assert len(optimal(bal)) == 4

    def test_everyone_settled(self):
        assert optimal({"A": 0, "B": 0}) == []

    def test_unbalanced_input_rejected(self):
        with pytest.raises(ValueError):
            optimal({"A": 5, "B": -3})

    @settings(max_examples=300, deadline=None)
    @given(st.lists(st.integers(-50_000, 50_000), min_size=1, max_size=7))
    def test_random_groups(self, values):
        values.append(-sum(values))
        bal = {i: v for i, v in enumerate(values)}
        nonzero = sum(1 for v in values if v)
        for method in (greedy, optimal):
            payments = method(bal)
            assert all(v == 0 for v in apply(bal, payments).values())
            assert len(payments) <= max(nonzero - 1, 0)
        assert len(optimal(bal)) <= len(greedy(bal))
        assert len(optimal(bal)) == brute_force_min(bal)


class TestBalances:
    def test_sum_is_zero_and_settlements_apply(self):
        expenses = [(1, 3000, {1: 1000, 2: 1000, 3: 1000}), (2, 900, {2: 450, 3: 450})]
        bal = compute_balances(expenses, [(3, 1, 500)])
        assert bal == {1: 1500, 2: -550, 3: -950}
        assert sum(bal.values()) == 0
