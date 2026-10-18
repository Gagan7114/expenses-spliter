"""Money is always integer paise (cents). Never floats."""
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation


class InvalidAmount(ValueError):
    pass


def to_cents(value) -> int:
    """'123.45' -> 12345. Rejects more than 2 decimal places."""
    try:
        d = Decimal(str(value).strip().replace(",", ""))
    except InvalidOperation:
        raise InvalidAmount("Enter a valid amount.")
    if not d.is_finite():
        raise InvalidAmount("Enter a valid amount.")
    if d != d.quantize(Decimal("0.01")):
        raise InvalidAmount("Use at most 2 decimal places.")
    return int((d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def split_evenly(total: int, n: int) -> list[int]:
    """Split `total` into `n` integer parts that sum exactly to `total`.
    The first `total % n` parts get one extra paisa: 10000 / 3 -> [3334, 3333, 3333]."""
    if n <= 0:
        raise ValueError("n must be positive")
    base, extra = divmod(total, n)
    return [base + 1 if i < extra else base for i in range(n)]
