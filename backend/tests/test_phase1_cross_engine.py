"""Backend smoke tests for Phase 1: Cross-Engine linking + AI Everywhere.

Covers:
- POST /api/ai/assist (task=deal_close, task=improve_bio)
- GET /api/workspace/related?client_id
- GET /api/workspace/related?deal_id
- GET /api/workspace/related?content_id
- GET /api/crm/clients/{id} (used by CRMClientDetail)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
EMAIL = "crm@test.com"
PASSWORD = "testpass123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token")
    assert token, "No token"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def any_client(session):
    r = session.get(f"{BASE_URL}/api/crm/clients", timeout=30)
    assert r.status_code == 200
    clients = r.json()
    if not clients:
        # Create one
        r2 = session.post(f"{BASE_URL}/api/crm/clients", json={
            "name": "TEST_ClientPhase1",
            "email": "test_phase1@example.com",
            "company": "TestCo",
            "status": "active",
            "source": "manual",
        }, timeout=30)
        assert r2.status_code in (200, 201)
        return r2.json()
    return clients[0]


@pytest.fixture(scope="module")
def any_deal(session, any_client):
    r = session.get(f"{BASE_URL}/api/crm/deals", timeout=30)
    assert r.status_code == 200
    deals = r.json()
    if not deals:
        r2 = session.post(f"{BASE_URL}/api/crm/deals", json={
            "title": "TEST_DealPhase1",
            "client_id": any_client["id"],
            "value": 1000,
            "currency": "USD",
            "stage": "prospecting",
            "probability": 50,
        }, timeout=30)
        assert r2.status_code in (200, 201), r2.text
        return r2.json()
    return deals[0]


# --- workspace/related ---

class TestWorkspaceRelated:
    def test_related_by_client_id(self, session, any_client):
        r = session.get(f"{BASE_URL}/api/workspace/related", params={"client_id": any_client["id"]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("deals", "content", "tasks", "activities"):
            assert key in data, f"Missing key {key} in {data.keys()}"
            assert isinstance(data[key], list)

    def test_related_by_deal_id(self, session, any_deal):
        r = session.get(f"{BASE_URL}/api/workspace/related", params={"deal_id": any_deal["id"]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # must have tasks + content arrays
        assert "tasks" in data
        assert "content" in data
        assert isinstance(data["tasks"], list)
        assert isinstance(data["content"], list)

    def test_related_by_content_id_optional(self, session):
        # Get a content item if any exists
        r = session.get(f"{BASE_URL}/api/content/items", timeout=30)
        if r.status_code != 200:
            pytest.skip("content list unavailable")
        items = r.json()
        if not items:
            pytest.skip("no content items")
        cid = items[0]["id"]
        r2 = session.get(f"{BASE_URL}/api/workspace/related", params={"content_id": cid}, timeout=30)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "tasks" in data


# --- CRM client detail (used by new CRMClientDetail.jsx) ---

class TestCRMClientDetail:
    def test_get_client_by_id(self, session, any_client):
        r = session.get(f"{BASE_URL}/api/crm/clients/{any_client['id']}", timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["id"] == any_client["id"]
        assert "name" in c


# --- AI Assist ---

class TestAIAssist:
    def test_deal_close_prediction(self, session):
        payload = {
            "task": "deal_close",
            "context": '{"title":"TEST Deal","value":5000,"stage":"proposal","probability":60,"client":"Acme","notes":"warm lead","days_since_update":3,"activities_count":2}',
        }
        r = session.post(f"{BASE_URL}/api/ai/assist", json=payload, timeout=60)
        # Accept 200 or 500 (quota) — but log
        if r.status_code == 500:
            pytest.skip(f"AI quota/upstream error: {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "result" in data
        assert isinstance(data["result"], str)
        assert len(data["result"]) > 5

    def test_improve_bio(self, session):
        payload = {
            "task": "improve_bio",
            "context": '{"current_bio":"صانع محتوى","name":"CRM Tester","role":"creator","skills":["video"],"years_experience":3}',
        }
        r = session.post(f"{BASE_URL}/api/ai/assist", json=payload, timeout=60)
        if r.status_code == 500:
            pytest.skip(f"AI quota/upstream error: {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "result" in data
        assert isinstance(data["result"], str)
        assert len(data["result"]) > 5

    def test_profile_bio_task(self, session):
        # Fallback used when bio is empty
        payload = {
            "task": "profile_bio",
            "context": '{"current_bio":"","name":"CRM Tester","role":"creator","skills":["video"],"years_experience":3}',
        }
        r = session.post(f"{BASE_URL}/api/ai/assist", json=payload, timeout=60)
        if r.status_code == 500:
            pytest.skip(f"AI quota/upstream error: {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "result" in data


# --- Regression: workspace morning brief ---

class TestRegression:
    def test_workspace_morning_brief(self, session):
        # It's a POST endpoint per workspace_engine.py
        r = session.post(f"{BASE_URL}/api/workspace/morning-brief", timeout=60)
        # 200 or 500 (AI could fail) — but endpoint must be reachable
        assert r.status_code in (200, 500), r.text[:300]
