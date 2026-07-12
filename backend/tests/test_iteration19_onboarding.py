"""Iteration 19 regression tests: First-time onboarding wizard.

Covers:
- POST /api/auth/signup schema (onboarding_completed:False, primary_goal:null, interests:[])
- GET /api/auth/me for new user
- POST /api/auth/onboarding for all 4 goals + invalid goal (400) + unauthenticated (401/403)
- Regression: /api/workspace/today, /api/billing/me, /api/crm/invoices
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env if env var not set in shell
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _mk_user_payload(prefix="onb"):
    ts = int(time.time() * 1000)
    u = f"{prefix}{ts}{uuid.uuid4().hex[:4]}"
    return {
        "name": f"TEST {prefix} {ts}",
        "username": u.lower(),
        "email": f"{u.lower()}@test.com",
        "password": "testpass123",
    }


@pytest.fixture
def new_user(session):
    payload = _mk_user_payload()
    r = session.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "payload": payload}


@pytest.fixture
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": "crm@test.com", "password": "testpass123"})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    return r.json()["token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Signup schema
# ---------------------------------------------------------------------------


class TestSignupSchema:
    def test_signup_returns_onboarding_flags(self, new_user):
        u = new_user["user"]
        assert u["onboarding_completed"] is False, f"expected False, got {u.get('onboarding_completed')}"
        assert u["primary_goal"] is None, f"expected None, got {u.get('primary_goal')}"
        assert u["interests"] == [], f"expected [], got {u.get('interests')}"
        assert "id" in u
        assert u["email"] == new_user["payload"]["email"]

    def test_me_reflects_new_schema(self, session, new_user):
        r = session.get(f"{API}/auth/me", headers=_auth(new_user["token"]))
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["onboarding_completed"] is False
        assert u["primary_goal"] is None
        assert u["interests"] == []


# ---------------------------------------------------------------------------
# POST /api/auth/onboarding
# ---------------------------------------------------------------------------


class TestOnboardingEndpoint:
    def test_unauthenticated_401(self, session):
        r = session.post(f"{API}/auth/onboarding", json={"primary_goal": "crm"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"

    def test_invalid_goal_returns_400(self, session, new_user):
        r = session.post(
            f"{API}/auth/onboarding",
            json={"primary_goal": "xyz", "interests": [], "experience_level": "beginner"},
            headers=_auth(new_user["token"]),
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    @pytest.mark.parametrize(
        "goal,expected_route",
        [
            ("crm", "/crm"),
            ("content", "/content/kanban"),
            ("tasks", "/tasks/boards"),
            ("all", "/workspace"),
        ],
    )
    def test_valid_goal_routes(self, session, goal, expected_route):
        payload = _mk_user_payload(f"onb{goal}")
        r = session.post(f"{API}/auth/signup", json=payload)
        assert r.status_code == 200, r.text
        tok = r.json()["token"]

        body = {"primary_goal": goal, "interests": ["marketplace", "community"], "experience_level": "intermediate"}
        r = session.post(f"{API}/auth/onboarding", json=body, headers=_auth(tok))
        assert r.status_code == 200, f"onboarding failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("next_route") == expected_route, f"goal={goal}: expected {expected_route}, got {data.get('next_route')}"
        assert data.get("onboarding_completed") is True
        assert data.get("primary_goal") == goal
        assert data.get("interests") == ["marketplace", "community"]

        # verify persistence via /me
        me = session.get(f"{API}/auth/me", headers=_auth(tok))
        assert me.status_code == 200
        me_data = me.json()
        assert me_data["onboarding_completed"] is True
        assert me_data["primary_goal"] == goal
        assert me_data["interests"] == ["marketplace", "community"]
        assert me_data.get("experience_level") == "intermediate"

    def test_optional_fields_default_ok(self, session, new_user):
        r = session.post(
            f"{API}/auth/onboarding",
            json={"primary_goal": "all"},
            headers=_auth(new_user["token"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["next_route"] == "/workspace"
        assert data["interests"] == []


# ---------------------------------------------------------------------------
# Regression: prev-iteration endpoints
# ---------------------------------------------------------------------------


class TestRegression:
    def test_workspace_today(self, session, admin_token):
        r = session.get(f"{API}/workspace/today", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)

    def test_billing_me(self, session, admin_token):
        r = session.get(f"{API}/billing/me", headers=_auth(admin_token))
        assert r.status_code == 200, r.text

    def test_crm_invoices(self, session, admin_token):
        r = session.get(f"{API}/crm/invoices", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)
