from datetime import date

import pytest
from django.utils import timezone

from tests.test_api import make_user  # noqa: F401  (fixture)


@pytest.fixture
def frozen_today(monkeypatch):
    monkeypatch.setattr(timezone, "localdate", lambda *a, **k: date(2026, 10, 10))


def test_milk_month_defaults_skips_and_extras(make_user, frozen_today):  # noqa: F811
    me = make_user("jashan")
    r = me.post("/api/daily-items/", {"name": "Milk", "unit": "L", "default_quantity": "3", "rate": "75", "start_date": "2026-10-01"}, format="json")
    assert r.status_code == 201, r.data
    item = r.data["id"]

    assert me.put(f"/api/daily-items/{item}/days/2026-10-04/", {"quantity": "0"}, format="json").status_code == 200
    assert me.put(f"/api/daily-items/{item}/days/2026-10-05/", {"quantity": "4.5"}, format="json").status_code == 200
    # Setting the default quantity just clears the override.
    me.put(f"/api/daily-items/{item}/days/2026-10-06/", {"quantity": "3"}, format="json")
    # Future days can't be changed.
    assert me.put(f"/api/daily-items/{item}/days/2026-10-11/", {"quantity": "0"}, format="json").status_code == 400

    m = me.get(f"/api/daily-items/{item}/month/", {"month": "2026-10"}).data
    status = {d["date"].day: d["status"] for d in m["days"]}
    assert status[4] == "skipped" and status[5] == "changed" and status[6] == "default" and status[11] == "future"
    # 10 days: 8 × 3 L + 0 + 4.5 L = 28.5 L × ₹75
    assert m["total_quantity"] == 28.5 or str(m["total_quantity"]) == "28.50"
    assert m["total_cents"] == 2850 * 75
    assert (m["delivered_days"], m["skipped_days"], m["changed_days"]) == (9, 1, 1)

    # Undo the skip.
    assert me.delete(f"/api/daily-items/{item}/days/2026-10-04/").status_code == 204
    assert me.get("/api/daily-items/").data[0]["this_month"]["total_cents"] == 3150 * 75


def test_daily_items_are_private(make_user):  # noqa: F811
    me, other = make_user("jashan"), make_user("priya")
    item = me.post("/api/daily-items/", {"name": "Milk", "default_quantity": "3", "rate": "75"}, format="json").data["id"]
    assert other.get(f"/api/daily-items/{item}/month/").status_code == 404
    assert other.get("/api/daily-items/").data == []
    assert me.post("/api/daily-items/", {"name": "Milk", "default_quantity": "3", "rate": "0"}, format="json").status_code == 400


def test_group_milk_is_shared_and_billed_once(make_user, frozen_today):  # noqa: F811
    a, b, outsider = make_user("jashan"), make_user("priya"), make_user("rahul")
    gid = a.post("/api/groups/", {"name": "Flat 4B", "type": "household"}, format="json").data["id"]
    b.post(f"/api/join/{a.get(f'/api/groups/{gid}/invite-link/').data['code']}/")
    members = {m["user"]["username"]: m["id"] for m in a.get(f"/api/groups/{gid}/").data["members"]}

    # Can't share into a group you're not in.
    r = outsider.post("/api/daily-items/", {"name": "Milk", "default_quantity": "3", "rate": "75", "group": gid}, format="json")
    assert r.status_code == 400 and "group" in r.data

    item = a.post("/api/daily-items/", {
        "name": "Milk", "default_quantity": "3", "rate": "75", "start_date": "2026-10-01", "group": gid,
    }, format="json").data
    assert item["group_name"] == "Flat 4B"

    # Any member can see and mark days; outsiders can't.
    assert b.put(f"/api/daily-items/{item['id']}/days/2026-10-02/", {"quantity": "0"}, format="json").status_code == 200
    assert outsider.get(f"/api/daily-items/{item['id']}/month/").status_code == 404
    assert b.delete(f"/api/daily-items/{item['id']}/").status_code == 403

    # 9 days × 3 L × ₹75 = ₹2,025, paid by Priya, split between both.
    r = a.post(f"/api/daily-items/{item['id']}/bill/", {"month": "2026-10", "paid_by": members["priya"]}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["amount_cents"] == 202500 and r.data["up_to_date"]
    assert a.get("/api/groups/").data[0]["my_balance_cents"] == -101250

    # A later change shows as out of date; adding again updates the same expense.
    a.put(f"/api/daily-items/{item['id']}/days/2026-10-03/", {"quantity": "4"}, format="json")
    assert a.get(f"/api/daily-items/{item['id']}/month/").data["bill"]["up_to_date"] is False
    r = a.post(f"/api/daily-items/{item['id']}/bill/", {"month": "2026-10", "paid_by": members["priya"]}, format="json")
    assert r.status_code == 200 and r.data["amount_cents"] == 210000
    expenses = a.get(f"/api/groups/{gid}/expenses/").data
    assert len(expenses) == 1 and expenses[0]["description"] == "Milk – October 2026"
