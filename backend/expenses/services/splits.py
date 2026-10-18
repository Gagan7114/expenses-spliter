from .money import split_evenly


def equal_split(total_cents: int, member_ids) -> dict:
    """Equal shares keyed by member id. Ids are sorted first, so the extra
    paise always land on the same members for the same input."""
    ids = sorted(set(member_ids))
    if not ids:
        raise ValueError("Pick at least one person to split with.")
    return dict(zip(ids, split_evenly(total_cents, len(ids))))
