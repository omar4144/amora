"""Iteration 20 regression tests: Personalized weekly recommendations.

Covers:
- POST /api/workspace/recommendations auth (401/403), first-call schema, from_cache flag
- Force regeneration via ?force=true
- Personalization difference for two users with different primary_goal
- Fallback resilience (empty user, no onboarding data)
- Regression: /api/workspace/today, /api/workspace/morning-brief still OK
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

VALID_ENGINES = {"crm", "content", "tasks", "marketplace", "community", "academy", "social"}
VALID_PRIORITIES = {"high", "medium", "low"}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _mk_user_payload(prefix="reco"):
    ts = int(time.time() * 1000)
    u = f"TEST{prefix}{ts}{uuid.uuid4().hex[:4]}"
    return {
        "name": f"TEST {prefix} {ts}",
        "username": u.lower(),
        "email": f"{u.lower()}@test.com",
        "password": "testpass123",
    }


def _signup(session, prefix="reco"):
    payload = _mk_user_payload(prefix)
    r = session.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _onboard(session, tok, goal, interests=None, level="intermediate"):
    r = session.post(
        f"{API}/auth/onboarding",
        json={"primary_goal": goal, "interests": interests or [], "experience_level": level},
        headers=_auth(tok),
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": "crm@test.com", "password": "testpass123"})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    return r.json()["token"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class TestAuth:
    def test_unauthenticated_denied(self, session):
        r = session.post(f"{API}/workspace/recommendations")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Schema + cache
# ---------------------------------------------------------------------------


def _validate_recs(data):
    assert "recommendations" in data, f"missing 'recommendations' in {data}"
    recs = data["recommendations"]
    assert isinstance(recs, list), f"recommendations not list: {type(recs)}"
    assert 1 <= len(recs) <= 3, f"expected 1-3 recos, got {len(recs)}"
    for i, r in enumerate(recs):
        assert isinstance(r, dict), f"reco[{i}] not dict"
        for k in ("title", "why", "action_label", "engine", "priority"):
            assert k in r, f"reco[{i}] missing key {k}: {r}"
        assert r["engine"] in VALID_ENGINES, f"reco[{i}] invalid engine '{r['engine']}'"
        assert r["priority"] in VALID_PRIORITIES, f"reco[{i}] invalid priority '{r['priority']}'"
        assert isinstance(r["title"], str) and len(r["title"]) > 0
        assert isinstance(r["why"], str)


class TestRecommendationsFlow:
    def test_first_call_schema_and_from_cache_false_then_true(self, session):
        tok, _u = _signup(session, "recoflow")
        _onboard(session, tok, "crm", interests=["marketplace"], level="beginner")

        # First call (force to bypass any cross-test cache)
        r1 = session.post(f"{API}/workspace/recommendations?force=true", headers=_auth(tok))
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        _validate_recs(d1)
        assert d1.get("from_cache") is False, f"first call should be fresh: {d1.get('from_cache')}"

        # Second call — must be cached
        r2 = session.post(f"{API}/workspace/recommendations", headers=_auth(tok))
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        _validate_recs(d2)
        assert d2.get("from_cache") is True, f"second call should be cached: {d2.get('from_cache')}"
        # Same content
        assert d2["recommendations"] == d1["recommendations"], "cache returned different recos"

    def test_force_regenerates(self, session):
        tok, _u = _signup(session, "recoforce")
        _onboard(session, tok, "content", interests=[], level="intermediate")

        r1 = session.post(f"{API}/workspace/recommendations", headers=_auth(tok))
        assert r1.status_code == 200, r1.text
        assert r1.json().get("from_cache") is False

        # Force
        r2 = session.post(f"{API}/workspace/recommendations?force=true", headers=_auth(tok))
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        _validate_recs(d2)
        assert d2.get("from_cache") is False, "force=true should bypass cache"


# ---------------------------------------------------------------------------
# Personalization
# ---------------------------------------------------------------------------


class TestPersonalization:
    def test_crm_goal_vs_content_goal_differ(self, session):
        # User A — CRM, 0 clients
        tok_a, _ua = _signup(session, "recoAcrm")
        _onboard(session, tok_a, "crm", interests=[])

        # User B — Content, 0 content
        tok_b, _ub = _signup(session, "recoBcnt")
        _onboard(session, tok_b, "content", interests=[])

        ra = session.post(f"{API}/workspace/recommendations?force=true", headers=_auth(tok_a))
        rb = session.post(f"{API}/workspace/recommendations?force=true", headers=_auth(tok_b))
        assert ra.status_code == 200 and rb.status_code == 200

        recs_a = ra.json()["recommendations"]
        recs_b = rb.json()["recommendations"]
        _validate_recs(ra.json())
        _validate_recs(rb.json())

        # Neither should be empty
        assert len(recs_a) >= 1 and len(recs_b) >= 1

        # Engines set should differ or at least top rec should differ
        engines_a = [r["engine"] for r in recs_a]
        engines_b = [r["engine"] for r in recs_b]
        assert engines_a != engines_b or recs_a[0]["title"] != recs_b[0]["title"], (
            f"personalization missing: A={recs_a} B={recs_b}"
        )

        # User A should mention CRM/client somewhere (goal=crm+clients=0)
        combined_a = " ".join([r["title"] + " " + r["why"] + " " + r["engine"] for r in recs_a]).lower()
        assert ("crm" in combined_a) or ("عميل" in combined_a) or ("client" in combined_a), (
            f"user A (crm goal, 0 clients) recos do not reference crm/client: {recs_a}"
        )


# ---------------------------------------------------------------------------
# Fallback / empty state
# ---------------------------------------------------------------------------


class TestFallback:
    def test_user_without_onboarding_still_gets_3(self, session):
        """New user, never onboarded → primary_goal None, interests []. Must not crash."""
        tok, u = _signup(session, "reconoonb")
        assert u.get("onboarding_completed") is False
        r = session.post(f"{API}/workspace/recommendations?force=true", headers=_auth(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        _validate_recs(data)
        assert len(data["recommendations"]) >= 1


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------


class TestRegression:
    def test_workspace_today_ok(self, session, admin_token):
        r = session.get(f"{API}/workspace/today", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        assert "quick_stats" in r.json()

    def test_morning_brief_ok(self, session, admin_token):
        r = session.post(f"{API}/workspace/morning-brief", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "summary" in data and "focus" in data

    def test_billing_me_ok(self, session, admin_token):
        r = session.get(f"{API}/billing/me", headers=_auth(admin_token))
        assert r.status_code == 200, r.text

    def test_super_admin_recos(self, session, admin_token):
        """Super admin should also get valid recos."""
        r = session.post(f"{API}/workspace/recommendations", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        _validate_recs(r.json())
