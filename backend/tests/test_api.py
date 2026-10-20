import pytest
from rest_framework.test import APIClient


@pytest.fixture
def make_user(db):
    def make(username):
        client = APIClient()
        r = client.post("/api/auth/register/", {
            "username": username, "email": f"{username}@example.com",
            "password": "tr1p-to-goa!", "display_name": username.title(),
        }, format="json")
        assert r.status_code == 201, r.data
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        client.user = r.data["user"]
        return client
    return make


def test_signup_login_and_user_id_rules(make_user):
    make_user("Jashan")
    anon = APIClient()
    assert anon.get("/api/users/check-id/", {"id": "JASHAN"}).data["available"] is False
    assert anon.get("/api/users/check-id/", {"id": "a!"}).data["available"] is False
    assert anon.get("/api/users/check-id/", {"id": "priya_22"}).data["available"] is True
    r = anon.post("/api/auth/login/", {"login": "@Jashan", "password": "tr1p-to-goa!"}, format="json")
    assert r.status_code == 200 and r.data["user"]["username"] == "jashan"
    r = anon.post("/api/auth/login/", {"login": "jashan@example.com", "password": "wrong"}, format="json")
    assert r.status_code == 401


def test_forgot_password_flow(make_user, mailoutbox):
    make_user("jashan")
    anon = APIClient()
    # Unknown accounts get the same answer and no email.
    assert anon.post("/api/auth/password-reset/", {"login": "nobody"}, format="json").status_code == 200
    assert len(mailoutbox) == 0

    assert anon.post("/api/auth/password-reset/", {"login": "@Jashan"}, format="json").status_code == 200
    assert len(mailoutbox) == 1 and mailoutbox[0].to == ["jashan@example.com"]
    link = next(w for w in mailoutbox[0].body.split() if "/reset-password?" in w)
    query = dict(p.split("=", 1) for p in link.split("?", 1)[1].split("&"))

    r = anon.post("/api/auth/password-reset/confirm/", {**query, "password": "password"}, format="json")
    assert r.status_code == 400 and "password" in r.data
    r = anon.post("/api/auth/password-reset/confirm/", {**query, "password": "new-m0nsoon-pass"}, format="json")
    assert r.status_code == 200 and r.data["user"]["username"] == "jashan"
    # The link is single-use: changing the password invalidates the token.
    r = anon.post("/api/auth/password-reset/confirm/", {**query, "password": "an0ther-pass!"}, format="json")
    assert r.status_code == 400

    r = anon.post("/api/auth/login/", {"login": "jashan", "password": "new-m0nsoon-pass"}, format="json")
    assert r.status_code == 200


def test_forgot_password_reports_email_problems(make_user, settings, monkeypatch):
    make_user("jashan")
    anon = APIClient()
    assert anon.post("/api/auth/password-reset/", {"login": ""}, format="json").status_code == 400

    backend = settings.EMAIL_BACKEND
    settings.EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    r = anon.post("/api/auth/password-reset/", {"login": "jashan"}, format="json")
    assert r.status_code == 503 and "isn't set up" in r.data["detail"]

    settings.EMAIL_BACKEND = backend

    def broken_send(*args, **kwargs):
        raise OSError("mail server unreachable")

    monkeypatch.setattr("accounts.views.send_mail", broken_send)
    r = anon.post("/api/auth/password-reset/", {"login": "jashan"}, format="json")
    assert r.status_code == 503 and "couldn't send" in r.data["detail"]


def test_full_group_flow(make_user):
    jashan, priya, rahul, outsider = (make_user(n) for n in ["jashan", "priya", "rahul", "outsider"])

    group = jashan.post("/api/groups/", {"name": "Goa trip", "type": "trip"}, format="json").data
    gid = group["id"]
    assert group["my_role"] == "admin"

    # Invite by link/code
    link = jashan.get(f"/api/groups/{gid}/invite-link/").data
    assert link["url"].endswith(link["code"])
    assert priya.get(f"/api/join/{link['code'].lower()}/").data["group"]["name"] == "Goa trip"
    assert priya.post(f"/api/join/{link['code']}/").status_code == 200

    # Direct invite by user ID
    inv = jashan.post(f"/api/groups/{gid}/invites/", {"username": "@Rahul"}, format="json")
    assert inv.status_code == 201
    inbox = rahul.get("/api/invites/").data
    assert len(inbox) == 1
    assert rahul.post(f"/api/invites/{inbox[0]['id']}/accept/").status_code == 200

    # Outsiders can't see the group
    assert outsider.get(f"/api/groups/{gid}/").status_code == 404
    assert outsider.get(f"/api/groups/{gid}/expenses/").status_code == 404

    members = {m["user"]["username"]: m["id"] for m in jashan.get(f"/api/groups/{gid}/").data["members"]}
    assert set(members) == {"jashan", "priya", "rahul"}
    everyone = list(members.values())

    r = jashan.post(f"/api/groups/{gid}/expenses/", {
        "description": "Villa", "amount": "3000", "paid_by": members["jashan"], "participants": everyone,
    }, format="json")
    assert r.status_code == 201, r.data
    priya.post(f"/api/groups/{gid}/expenses/", {
        "description": "Dinner", "amount": "100", "paid_by": members["priya"], "participants": everyone,
    }, format="json")

    bal = jashan.get(f"/api/groups/{gid}/balances/").data
    assert sum(bal.values()) == 0
    assert bal[str(members["jashan"])] == 300000 - 100000 - 3334  # 10000 / 3 -> 3334, 3333, 3333

    plan = jashan.get(f"/api/groups/{gid}/settle/").data
    assert plan["optimal_count"] == 2
    for p in plan["payments"]:
        r = rahul.post(f"/api/groups/{gid}/settlements/", {
            "from_member": p["from"], "to_member": p["to"], "amount": p["amount_cents"] / 100,
        }, format="json")
        assert r.status_code == 201, r.data
    assert all(v == 0 for v in jashan.get(f"/api/groups/{gid}/balances/").data.values())
    assert jashan.get("/api/groups/").data[0]["my_balance_cents"] == 0

    # Only admins can reset the link; old code stops working
    assert priya.post(f"/api/groups/{gid}/invite-link/reset/").status_code == 403
    new = jashan.post(f"/api/groups/{gid}/invite-link/reset/").data
    assert new["code"] != link["code"]
    assert outsider.post(f"/api/join/{link['code']}/").status_code == 400


def test_cannot_leave_with_open_balance(make_user):
    a, b = make_user("anna"), make_user("ben")
    gid = a.post("/api/groups/", {"name": "Flat 4B", "type": "household"}, format="json").data["id"]
    b.post(f"/api/join/{a.get(f'/api/groups/{gid}/invite-link/').data['code']}/")
    members = {m["user"]["username"]: m["id"] for m in a.get(f"/api/groups/{gid}/").data["members"]}
    a.post(f"/api/groups/{gid}/expenses/", {
        "description": "Wifi", "amount": "999", "paid_by": members["anna"], "participants": list(members.values()),
    }, format="json")
    r = b.delete(f"/api/groups/{gid}/members/{members['ben']}/")
    assert r.status_code == 400
    assert "Settle up" in r.data["detail"]


def test_one_user_many_groups(make_user):
    a = make_user("multi")
    for name in ["Flat", "Goa", "Office lunch"]:
        a.post("/api/groups/", {"name": name}, format="json")
    assert len(a.get("/api/groups/").data) == 3


def test_weak_password_is_a_field_error(db):
    r = APIClient().post("/api/auth/register/", {
        "username": "weak", "email": "weak@example.com", "password": "password",
    }, format="json")
    assert r.status_code == 400
    assert "password" in r.data


def test_activity_and_pending_across_groups(make_user):
    a, b, outsider = make_user("asha"), make_user("bilal"), make_user("stranger")
    gids = []
    for name in ["Flat", "Trip"]:
        gid = a.post("/api/groups/", {"name": name}, format="json").data["id"]
        b.post(f"/api/join/{a.get(f'/api/groups/{gid}/invite-link/').data['code']}/")
        members = {m["user"]["username"]: m["id"] for m in a.get(f"/api/groups/{gid}/").data["members"]}
        a.post(f"/api/groups/{gid}/expenses/", {
            "description": f"{name} cost", "amount": "100", "paid_by": members["asha"], "participants": list(members.values()),
        }, format="json")
        gids.append(gid)

    feed = b.get("/api/activity/").data
    assert [i["description"] for i in feed if i["kind"] == "expense"] == ["Trip cost", "Flat cost"]
    assert all(i["my_share_cents"] == 5000 for i in feed)
    assert len(b.get("/api/activity/", {"group": gids[0]}).data) == 1

    pend = b.get("/api/pending/").data
    assert len(pend) == 2
    assert pend[0]["payments"][0]["from"]["username"] == "bilal"
    assert pend[0]["payments"][0]["amount_cents"] == 5000

    assert outsider.get("/api/activity/").data == []
    assert outsider.get("/api/pending/").data == []


def test_upi_id_is_shared_with_group_members_only(make_user):
    jashan, priya, outsider = (make_user(n) for n in ["jashan", "priya", "outsider"])
    assert jashan.patch("/api/me/", {"upi_id": "not-a-upi"}, format="json").status_code == 400
    r = jashan.patch("/api/me/", {"upi_id": " Jashan.S@OkHDFCbank "}, format="json")
    assert r.status_code == 200 and r.data["upi_id"] == "jashan.s@okhdfcbank"

    gid = jashan.post("/api/groups/", {"name": "Flat", "type": "household"}, format="json").data["id"]
    priya.post(f"/api/join/{jashan.get(f'/api/groups/{gid}/invite-link/').data['code']}/")
    members = priya.get(f"/api/groups/{gid}/").data["members"]
    assert {m["user"]["username"]: m["user"]["upi_id"] for m in members} == {"jashan": "jashan.s@okhdfcbank", "priya": ""}

    jm = next(m["id"] for m in members if m["user"]["username"] == "jashan")
    pm = next(m["id"] for m in members if m["user"]["username"] == "priya")
    jashan.post(f"/api/groups/{gid}/expenses/", {
        "description": "Rent", "amount": "1000", "paid_by": jm, "participants": [jm, pm],
    }, format="json")
    pay = priya.get("/api/pending/").data[0]["payments"][0]
    assert pay["to"]["upi_id"] == "jashan.s@okhdfcbank"

    # Strangers searching by user ID don't see it.
    assert "upi_id" not in outsider.get("/api/users/search/", {"q": "jas"}).data[0]
    # Clearing it is allowed.
    assert jashan.patch("/api/me/", {"upi_id": ""}, format="json").data["upi_id"] == ""
