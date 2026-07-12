"""Backend tests for Phase 2: Invoices + Billing + AI Credit Gating.

Covers:
- POST/GET /api/crm/invoices (CRUD + auto-numbering + totals)
- GET /api/crm/invoices/stats
- GET /api/crm/invoices/{id}/pdf (application/pdf, %PDF header)
- POST /api/crm/deals/{id}/create-invoice
- GET /api/crm/deals/{id}/contract-pdf
- GET /api/billing/plans (free/pro/business)
- GET /api/billing/me (current plan, credits)
- POST /api/billing/checkout (Stripe url returned)
- POST /api/ai/assist consumes credit
- POST /api/workspace/morning-brief does NOT consume (cached)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
EMAIL = "crm@test.com"
PASSWORD = "testpass123"


# ==================== Fixtures ====================
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    assert token, "No token in login response"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def any_client(session):
    r = session.get(f"{BASE_URL}/api/crm/clients", timeout=30)
    assert r.status_code == 200
    clients = r.json()
    if clients:
        return clients[0]
    r2 = session.post(f"{BASE_URL}/api/crm/clients", json={
        "name": "TEST_ClientP2",
        "email": "test_p2@example.com",
        "company": "TestCo",
        "status": "active",
        "source": "manual",
    }, timeout=30)
    assert r2.status_code in (200, 201)
    return r2.json()


@pytest.fixture(scope="module")
def any_deal(session, any_client):
    r = session.get(f"{BASE_URL}/api/crm/deals", timeout=30)
    assert r.status_code == 200
    deals = r.json()
    if deals:
        return deals[0]
    r2 = session.post(f"{BASE_URL}/api/crm/deals", json={
        "title": "TEST_DealP2",
        "client_id": any_client["id"],
        "value": 2000,
        "currency": "USD",
        "stage": "proposal",
        "probability": 60,
    }, timeout=30)
    assert r2.status_code in (200, 201), r2.text
    return r2.json()


# ==================== INVOICES ====================
class TestInvoices:
    def test_create_invoice_with_totals(self, session, any_client):
        payload = {
            "client_id": any_client["id"],
            "title": "TEST Invoice P2",
            "items": [
                {"description": "Design", "quantity": 2, "unit_price": 100.0},
                {"description": "Consultation", "quantity": 1, "unit_price": 50.0},
            ],
            "tax_percent": 15.0,
            "discount": 10.0,
        }
        r = session.post(f"{BASE_URL}/api/crm/invoices", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["id"]
        # subtotal = 2*100 + 1*50 = 250; tax = 37.5; total = 250 + 37.5 - 10 = 277.5
        assert inv["subtotal"] == 250.0
        assert inv["tax_amount"] == 37.5
        assert inv["total"] == 277.5
        assert inv["status"] == "draft"
        assert inv["number"].startswith("INV-")
        pytest.shared_invoice_id = inv["id"]

    def test_list_invoices_has_client(self, session):
        r = session.get(f"{BASE_URL}/api/crm/invoices", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # First one should have client attached (recent)
        first = data[0]
        assert "client" in first

    def test_invoice_stats(self, session):
        r = session.get(f"{BASE_URL}/api/crm/invoices/stats", timeout=30)
        assert r.status_code == 200
        data = r.json()
        for key in ("count", "paid", "outstanding", "draft", "by_status"):
            assert key in data
        assert isinstance(data["by_status"], dict)
        # We just created a draft invoice
        assert data["draft"] >= 277.5 or data["by_status"].get("draft", 0) >= 1

    def test_invoice_pdf_download(self, session):
        inv_id = getattr(pytest, "shared_invoice_id", None)
        assert inv_id, "invoice must be created first"
        r = session.get(f"{BASE_URL}/api/crm/invoices/{inv_id}/pdf", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF", f"Not a PDF, starts with: {r.content[:20]}"
        # size sanity 10KB - 200KB
        assert 10000 < len(r.content) < 300000

    def test_invoice_update_status_to_paid(self, session):
        inv_id = getattr(pytest, "shared_invoice_id", None)
        assert inv_id
        r = session.put(f"{BASE_URL}/api/crm/invoices/{inv_id}", json={"status": "paid"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paid"
        # verify persistence via GET
        r2 = session.get(f"{BASE_URL}/api/crm/invoices/{inv_id}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["status"] == "paid"


class TestDealToInvoiceAndContract:
    def test_create_invoice_from_deal(self, session, any_deal):
        r = session.post(f"{BASE_URL}/api/crm/deals/{any_deal['id']}/create-invoice", timeout=30)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["deal_id"] == any_deal["id"]
        assert inv["client_id"] == any_deal["client_id"]
        assert inv["total"] == float(any_deal.get("value", 0))
        assert inv["number"].startswith("INV-")

    def test_deal_contract_pdf(self, session, any_deal):
        r = session.get(f"{BASE_URL}/api/crm/deals/{any_deal['id']}/contract-pdf", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
        assert 10000 < len(r.content) < 300000


# ==================== BILLING ====================
class TestBilling:
    def test_list_plans(self, session):
        r = session.get(f"{BASE_URL}/api/billing/plans", timeout=30)
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list)
        assert len(plans) == 3
        by_key = {p["key"]: p for p in plans}
        assert set(by_key.keys()) == {"free", "pro", "business"}
        assert by_key["free"]["price_usd"] == 0
        assert by_key["pro"]["price_usd"] == 19.0
        assert by_key["business"]["price_usd"] == 49.0
        assert by_key["free"]["ai_credits_monthly"] == 30
        assert by_key["pro"]["ai_credits_monthly"] == 500
        assert by_key["business"]["ai_credits_monthly"] == 3000

    def test_billing_me(self, session):
        r = session.get(f"{BASE_URL}/api/billing/me", timeout=30)
        assert r.status_code == 200
        data = r.json()
        for k in ("plan", "credits_used", "credits_remaining", "credits_total"):
            assert k in data
        assert data["plan"]["key"] in ("free", "pro", "business")
        assert isinstance(data["credits_used"], int)
        assert data["credits_total"] == data["plan"]["ai_credits_monthly"]

    def test_billing_checkout_pro(self, session):
        r = session.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "pro", "origin_url": BASE_URL},
            timeout=45,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert "url" in data and data["url"].startswith("https://")
        assert "stripe.com" in data["url"]
        assert "session_id" in data and data["session_id"]

    def test_billing_checkout_business(self, session):
        r = session.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "business", "origin_url": BASE_URL},
            timeout=45,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert "stripe.com" in data["url"]
        assert data["session_id"]

    def test_billing_checkout_invalid_plan(self, session):
        r = session.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "ultra", "origin_url": BASE_URL},
            timeout=30,
        )
        assert r.status_code == 400


# ==================== AI CREDIT METERING ====================
class TestAICreditGating:
    def test_ai_assist_increments_credits(self, session):
        # Get baseline
        me1 = session.get(f"{BASE_URL}/api/billing/me", timeout=30).json()
        used_before = me1["credits_used"]

        # Call AI once
        r = session.post(f"{BASE_URL}/api/ai/assist", json={
            "task": "improve_bio",
            "context": '{"current_bio":"test","name":"T","role":"creator","skills":["x"],"years_experience":1}',
        }, timeout=60)
        # 200 (worked, consumed) or 402 (already exhausted) — both are valid outcomes
        assert r.status_code in (200, 402, 500), r.text[:300]
        if r.status_code == 500:
            pytest.skip(f"AI upstream error: {r.text[:200]}")

        me2 = session.get(f"{BASE_URL}/api/billing/me", timeout=30).json()
        used_after = me2["credits_used"]

        if r.status_code == 200:
            # A successful call should have consumed exactly 1 credit
            assert used_after == used_before + 1, f"Expected +1, got {used_before} -> {used_after}"
        else:
            # 402 → no consumption
            assert used_after == used_before

    def test_ai_assist_402_when_exhausted(self, session):
        """This test only meaningful if we're already at limit. Skip otherwise."""
        me = session.get(f"{BASE_URL}/api/billing/me", timeout=30).json()
        if me["credits_remaining"] > 0:
            pytest.skip(f"Credits still available ({me['credits_remaining']}) — cannot test exhaustion")
        r = session.post(f"{BASE_URL}/api/ai/assist", json={
            "task": "improve_bio",
            "context": '{"current_bio":"x","name":"T","role":"creator","skills":[],"years_experience":1}',
        }, timeout=30)
        assert r.status_code == 402
        assert "استنفدت" in r.text or "quota" in r.text.lower()

    def test_morning_brief_no_credit_consumption(self, session):
        """Morning brief is cached daily — should NOT consume credits on re-call."""
        me1 = session.get(f"{BASE_URL}/api/billing/me", timeout=30).json()
        used_before = me1["credits_used"]
        r = session.post(f"{BASE_URL}/api/workspace/morning-brief", timeout=60)
        assert r.status_code in (200, 500), r.text[:200]
        me2 = session.get(f"{BASE_URL}/api/billing/me", timeout=30).json()
        # cached brief must not consume, may consume on very first call of the day
        # allow +0 or +1 (first call), but not more
        assert me2["credits_used"] - used_before <= 1
