"""
Backend tests for POST /api/workspace/morning-brief (Morning Brief feature).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env value read directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

SUPER_ADMIN = {"email": "crm@test.com", "password": "testpass123"}


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def authed(api_client, auth_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
    })
    return s


class TestMorningBriefAuth:
    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/workspace/morning-brief", timeout=30)
        # 401 preferred; 403 also acceptable
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"


class TestMorningBriefFlow:
    """Sequential tests: first call → cache miss, second → cache hit, force=true → regenerate."""

    def test_1_first_call_no_cache(self, authed):
        # Delete any existing brief for today to guarantee cache-miss (via force=true)
        r = authed.post(f"{BASE_URL}/api/workspace/morning-brief?force=true", timeout=60)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text[:300]}"
        data = r.json()
        # Required fields
        for field in ["user_id", "date", "summary", "focus", "created_at", "from_cache"]:
            assert field in data, f"Missing field '{field}' in response: {list(data.keys())}"

        assert data["from_cache"] is False, f"Expected from_cache=False, got {data['from_cache']}"
        assert isinstance(data["summary"], str) and len(data["summary"]) > 0, "Summary empty"
        assert isinstance(data["focus"], list)
        assert len(data["focus"]) <= 3, f"focus has {len(data['focus'])} items, expected <=3"

        for f in data["focus"]:
            assert "title" in f
            assert "why" in f
            assert "engine" in f
            assert "ref_id" in f
            assert f["engine"] in ("crm", "tasks", "content"), f"Bad engine: {f['engine']}"

        # Save for next test
        pytest.brief_first = data

    def test_2_second_call_returns_cache(self, authed):
        r = authed.post(f"{BASE_URL}/api/workspace/morning-brief", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["from_cache"] is True, f"Expected from_cache=True, got {data['from_cache']}"
        # Should match first response's summary
        assert data["summary"] == pytest.brief_first["summary"]
        assert data["date"] == pytest.brief_first["date"]

    def test_3_force_regenerates(self, authed):
        r = authed.post(f"{BASE_URL}/api/workspace/morning-brief?force=true", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["from_cache"] is False, f"Expected from_cache=False with force=true, got {data['from_cache']}"
        assert isinstance(data["summary"], str) and len(data["summary"]) > 0
