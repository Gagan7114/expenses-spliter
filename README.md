# Tab: expense splitter

Split shared costs with roommates or on trips, then settle up with the fewest payments.

- **frontend/**: React 19 + TypeScript + Vite + Tailwind, mobile first
- **backend/**: Django 5.2 + Django REST Framework + JWT auth
- **Database**: PostgreSQL (local)

## 1. PostgreSQL

PostgreSQL 18 is installed for this user only (no sudo) in `~/.local/postgresql`:

| What | Where |
|---|---|
| Program files | `~/.local/postgresql/usr/lib/postgresql/18/` |
| Data | `~/.local/postgresql/data/` |
| Admin (postgres) password | `~/.local/postgresql/admin-credentials.txt` |
| App database / user | `splitter` / `splitter` on `localhost:5432` |
| App connection string | `backend/.env` → `DATABASE_URL` |

It runs as a user service and starts automatically when you log in:

```bash
systemctl --user status postgresql-local     # check
systemctl --user restart postgresql-local    # restart
journalctl --user -u postgresql-local        # logs
```

Open the database: `cd backend && .venv/bin/python manage.py dbshell`, or `psql -h localhost -U splitter splitter` (the `psql` command is in `~/.local/bin`).

## 2. Backend

```bash
cd backend
python3 -m venv .venv            # already done if .venv exists
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser   # optional, for /admin
.venv/bin/python manage.py runserver
```

The API runs at http://127.0.0.1:8000/api/ and the admin panel at http://127.0.0.1:8000/admin/.

Run the tests (they create and delete their own test database):

```bash
.venv/bin/pytest
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` to Django, so both must be running.

**On your phone:** connect to the same Wi-Fi and open the "Network" address Vite prints (for example `http://192.168.1.20:5173`).

## What works (v1)

- Sign up with your own user ID (live availability check); sign in with user ID or email
- Create any number of groups, and be in any number of groups
- Invite by link, 6-character code, or directly by user ID (in-app inbox)
- Admins: reset the invite link, make admin, remove members, rename or delete the group
- Leave a group once your balance is zero
- Add, edit and delete expenses with an equal split among chosen people
- Live balances, and a settle-up screen with the minimum number of payments
- Mark payments as paid
- Groups refresh every 10 seconds so everyone sees changes

## Not built yet

- Live updates over WebSockets (Django Channels); polling is used for now
- Google sign-in
- Install as an app (PWA)
- v2 and v3 features from the plan
