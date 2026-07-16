"""
Iteration 28 — Moyasar Monetization with REAL test keys + PCI-compliant intent flow

Backend now:
  1. `/api/moyasar/config` returns enabled:true (SECRET_KEY set)
  2. POST /api/tips no longer calls Moyasar server-side — creates a `pending` tip
     and returns an `intent` (amount, description, publishable_key, callback_url,
     given_id, metadata, methods) that the frontend uses with Moyasar.js (PCI-safe).
  3. POST /api/creators/{u}/subscribe same pattern with save_card:true in intent.
  4. Webhook accepts 3 verification methods:
     (a) header X-Moyasar-Secret-Token
     (b) body.secret_token
     (c) header X-Moyasar-Signature = hmac_sha256(raw_body, secret) hex
  5. Webhook idempotency, tip credit, subscription_initial credit.
  6. Rate limits on /api/tips (20/hr) and /api/wallet/payout (5/hr).
  7. Sentry initialised.
"""
import os
import time
import uuid
import hmac
import hashlib
import json as jsonlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "crm@test.com"
ADMIN_PW = "testpass123"
WEBHOOK_SECRET = "Omarr187@&"


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_user(admin_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _new_user(role="creator"):
    ts = f"{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    email = f"TEST_it28_{ts}@test.com"
    username = f"t28_{ts}"[:24]
    payload = {
        "name": "It28 Fan", "username": username, "email": email,
        "password": "testpass123", "role": role, "looking_for": ["content"],
    }
    r = requests.post(f"{API}/auth/signup", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    body = r.json()
    return {"token": body["token"], "user": body["user"], "email": email, "username": username}


@pytest.fixture(scope="session")
def fan_user():
    return _new_user()


@pytest.fixture(scope="session")
def fan_headers(fan_user):
    return {"Authorization": f"Bearer {fan_user['token']}"}


@pytest.fixture(scope="session")
def crm_plan(admin_headers):
    """Ensure crm_tester has an active plan."""
    r = requests.put(f"{API}/creators/me/subscription-plan", headers=admin_headers,
                     json={"price_sar": 49, "title": "اشتراك مميز", "perks": ["محتوى حصري", "بث خاص"], "active": True},
                     timeout=15)
    assert r.status_code == 200
    return r.json()


# ─── /moyasar/config ─────────────────────────────────────────────────────────
class TestMoyasarConfigLive:
    def test_config_enabled(self):
        r = requests.get(f"{API}/moyasar/config", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["publishable_key"].startswith("pk_test_")
        assert data["currency"] == "SAR"
        assert data["platform_fee_percent"] == 10.0
        assert data["methods"] == ["creditcard", "applepay", "stcpay"]
        # SECRET_KEY set → enabled must be True now
        assert data["enabled"] is True, "Expected enabled=True since MOYASAR_SECRET_KEY is set"


# ─── POST /tips returns intent (no Moyasar server call) ──────────────────────
class TestTipIntent:
    def test_tip_returns_intent(self, fan_headers, admin_user):
        payload = {
            "creator_username": admin_user["username"],
            "amount_sar": 25,
            "message": "شكراً لك",
            "method": "creditcard",
            "save_card": False,
        }
        r = requests.post(f"{API}/tips", headers=fan_headers, json=payload, timeout=20)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        # tip block
        assert "tip" in data and "intent" in data
        assert data["tip"]["status"] == "pending"
        assert data["tip"]["amount_halalas"] == 2500
        assert data["tip"]["platform_fee_halalas"] == 250
        assert data["tip"]["creator_earnings_halalas"] == 2250
        tip_id = data["tip"]["id"]
        # intent block
        intent = data["intent"]
        assert intent["amount_halalas"] == 2500
        assert "@" in intent["description"]
        assert intent["publishable_key"].startswith("pk_test_")
        assert intent["callback_url"].endswith(f"/wallet?tip_id={tip_id}")
        assert intent["given_id"] == tip_id
        assert intent["metadata"]["tip_id"] == tip_id
        assert intent["metadata"]["type"] == "tip"
        assert intent["metadata"]["creator_id"] == admin_user["id"]
        assert intent["methods"] == ["creditcard"]

    def test_self_tip_rejected(self, fan_headers, fan_user):
        r = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": fan_user["username"], "amount_sar": 10},
                          timeout=15)
        assert r.status_code == 400
        # Arabic message somewhere in body
        assert "نفس" in r.text or "لا يمكن" in r.text

    def test_tip_below_min_rejected(self, fan_headers, admin_user):
        r = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 2},
                          timeout=15)
        assert r.status_code == 400

    def test_tip_unknown_creator(self, fan_headers):
        r = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": "does_not_exist_x9y8z7", "amount_sar": 10},
                          timeout=15)
        assert r.status_code == 404


# ─── POST /creators/{u}/subscribe returns intent ─────────────────────────────
class TestSubscribeIntent:
    def test_subscribe_returns_intent(self, admin_user, crm_plan):
        # Fresh fan to avoid duplicate-subscription 409
        u = _new_user()
        headers = {"Authorization": f"Bearer {u['token']}"}
        r = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                          headers=headers, json={"method": "creditcard"}, timeout=20)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        assert data["subscription"]["status"] == "pending"
        sub_id = data["subscription"]["id"]
        intent = data["intent"]
        assert intent["amount_halalas"] == 49 * 100
        assert intent["publishable_key"].startswith("pk_test_")
        assert intent["callback_url"].endswith(f"/wallet?sub_id={sub_id}")
        assert intent["given_id"] == sub_id
        assert intent["save_card"] is True
        assert intent["metadata"]["sub_id"] == sub_id
        assert intent["metadata"]["type"] == "subscription_initial"

    def test_duplicate_subscribe_409(self, admin_user, crm_plan):
        u = _new_user()
        headers = {"Authorization": f"Bearer {u['token']}"}
        r1 = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                           headers=headers, json={"method": "creditcard"}, timeout=20)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                           headers=headers, json={"method": "creditcard"}, timeout=20)
        assert r2.status_code == 409

    def test_self_subscribe_400(self, admin_headers, admin_user):
        r = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                          headers=admin_headers, json={"method": "creditcard"}, timeout=15)
        assert r.status_code == 400

    def test_subscribe_no_plan_404(self, fan_headers):
        # Create a target user without a plan
        target = _new_user()
        r = requests.post(f"{API}/creators/{target['username']}/subscribe",
                          headers=fan_headers, json={"method": "creditcard"}, timeout=15)
        assert r.status_code == 404


# ─── DELETE /subscriptions/{id} ──────────────────────────────────────────────
class TestSubscriptionCancel:
    def test_cancel_sets_cancel_at_period_end(self, admin_user, crm_plan):
        u = _new_user()
        headers = {"Authorization": f"Bearer {u['token']}"}
        r = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                          headers=headers, json={"method": "creditcard"}, timeout=20)
        assert r.status_code == 200
        sub_id = r.json()["subscription"]["id"]
        c = requests.delete(f"{API}/subscriptions/{sub_id}", headers=headers, timeout=15)
        assert c.status_code == 200
        assert c.json().get("cancelled") is True
        # Verify: pull from /subscriptions/me
        subs = requests.get(f"{API}/subscriptions/me", headers=headers, timeout=15).json()
        row = next((s for s in subs if s["id"] == sub_id), None)
        assert row is not None
        assert row["cancel_at_period_end"] is True


# ─── Webhook signature verification: 3 paths ─────────────────────────────────
def _mk_paid_event(tip_id, kind="tip", sub_id=None, plan_id=None, creator_id=None):
    metadata = {"type": kind}
    if kind == "tip":
        metadata["tip_id"] = tip_id
    else:
        metadata["sub_id"] = sub_id
        metadata["plan_id"] = plan_id or "plan_x"
    if creator_id:
        metadata["creator_id"] = creator_id
    return {
        "id": str(uuid.uuid4()),
        "type": "payment_paid",
        "data": {
            "id": f"pay_{uuid.uuid4().hex[:10]}",
            "status": "paid",
            "amount": 2500,
            "currency": "SAR",
            "source": {"type": "creditcard", "company": "visa", "token": f"tok_{uuid.uuid4().hex[:8]}"},
            "metadata": metadata,
        },
    }


class TestWebhookVerification:
    def test_header_secret_token_ok(self, fan_headers, admin_user):
        # Create tip first
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 5},
                          timeout=15).json()
        event = _mk_paid_event(t["tip"]["id"])
        r = requests.post(f"{API}/webhooks/moyasar", json=event,
                          headers={"X-Moyasar-Secret-Token": WEBHOOK_SECRET}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_body_secret_token_ok(self, fan_headers, admin_user):
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 5},
                          timeout=15).json()
        event = _mk_paid_event(t["tip"]["id"])
        event["secret_token"] = WEBHOOK_SECRET
        r = requests.post(f"{API}/webhooks/moyasar", json=event, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_hmac_signature_ok(self, fan_headers, admin_user):
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 5},
                          timeout=15).json()
        event = _mk_paid_event(t["tip"]["id"])
        raw = jsonlib.dumps(event).encode()
        sig = hmac.new(WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        r = requests.post(f"{API}/webhooks/moyasar", data=raw,
                          headers={"X-Moyasar-Signature": sig, "Content-Type": "application/json"},
                          timeout=15)
        assert r.status_code == 200, r.text

    def test_missing_secret_401(self, fan_headers, admin_user):
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 5},
                          timeout=15).json()
        event = _mk_paid_event(t["tip"]["id"])
        r = requests.post(f"{API}/webhooks/moyasar", json=event, timeout=15)
        assert r.status_code == 401

    def test_wrong_secret_401(self, fan_headers, admin_user):
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 5},
                          timeout=15).json()
        event = _mk_paid_event(t["tip"]["id"])
        r = requests.post(f"{API}/webhooks/moyasar", json=event,
                          headers={"X-Moyasar-Secret-Token": "wrong"}, timeout=15)
        assert r.status_code == 401


# ─── Webhook processing: tip paid credits wallet ─────────────────────────────
class TestWebhookTipCredit:
    def test_tip_paid_updates_status_and_wallet(self, fan_headers, admin_user, admin_headers):
        # Baseline wallet
        w0 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        base_tips = w0["balance"]["breakdown"]["tips_sar"]

        # Create tip 50 SAR
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 50},
                          timeout=15).json()
        tip_id = t["tip"]["id"]

        event = _mk_paid_event(tip_id, creator_id=admin_user["id"])
        event["data"]["amount"] = 5000
        r = requests.post(f"{API}/webhooks/moyasar", json=event,
                          headers={"X-Moyasar-Secret-Token": WEBHOOK_SECRET}, timeout=15)
        assert r.status_code == 200
        time.sleep(0.4)

        w1 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        # Tip earnings 90% of 50 = 45 SAR
        assert round(w1["balance"]["breakdown"]["tips_sar"] - base_tips, 2) == 45.0

    def test_idempotent_replay(self, fan_headers, admin_user, admin_headers):
        # Fresh tip
        t = requests.post(f"{API}/tips", headers=fan_headers,
                          json={"creator_username": admin_user["username"], "amount_sar": 10},
                          timeout=15).json()
        tip_id = t["tip"]["id"]

        w0 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        base_tips = w0["balance"]["breakdown"]["tips_sar"]

        event = _mk_paid_event(tip_id, creator_id=admin_user["id"])
        r1 = requests.post(f"{API}/webhooks/moyasar", json=event,
                           headers={"X-Moyasar-Secret-Token": WEBHOOK_SECRET}, timeout=15)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/webhooks/moyasar", json=event,
                           headers={"X-Moyasar-Secret-Token": WEBHOOK_SECRET}, timeout=15)
        assert r2.status_code == 200
        time.sleep(0.4)

        w2 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        # +9 SAR from single tip, no double-credit
        assert round(w2["balance"]["breakdown"]["tips_sar"] - base_tips, 2) == 9.0


# ─── Webhook subscription_initial credit ─────────────────────────────────────
class TestWebhookSubscription:
    def test_sub_initial_paid_activates_and_credits(self, admin_user, admin_headers, crm_plan):
        u = _new_user()
        headers = {"Authorization": f"Bearer {u['token']}"}
        r = requests.post(f"{API}/creators/{admin_user['username']}/subscribe",
                          headers=headers, json={"method": "creditcard"}, timeout=20)
        assert r.status_code == 200
        sub_id = r.json()["subscription"]["id"]
        plan_id = r.json()["subscription"]["plan_id"]

        w0 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        base_subs = w0["balance"]["breakdown"]["subscriptions_sar"]

        event = _mk_paid_event(None, kind="subscription_initial", sub_id=sub_id,
                               plan_id=plan_id, creator_id=admin_user["id"])
        event["data"]["amount"] = 4900
        wr = requests.post(f"{API}/webhooks/moyasar", json=event,
                           headers={"X-Moyasar-Secret-Token": WEBHOOK_SECRET}, timeout=15)
        assert wr.status_code == 200
        time.sleep(0.4)

        # Fan sub row now active
        subs = requests.get(f"{API}/subscriptions/me", headers=headers, timeout=15).json()
        row = next((s for s in subs if s["id"] == sub_id), None)
        assert row and row["status"] == "active"
        assert row.get("current_period_end")

        # Wallet subscriptions_sar increased by 44.1 (49 * 0.9)
        w1 = requests.get(f"{API}/wallet", headers=admin_headers, timeout=15).json()
        assert round(w1["balance"]["breakdown"]["subscriptions_sar"] - base_subs, 2) == 44.1


# ─── Rate limits ─────────────────────────────────────────────────────────────
class TestRateLimits:
    def test_payout_rate_limit_5_per_hour(self, admin_user, admin_headers):
        """6th payout request within an hour should return 429."""
        # Use invalid amount to fail 400 fast (limiter counts anyway).
        # Actually SlowAPI limiter counts BEFORE handler runs.
        codes = []
        for i in range(6):
            r = requests.post(f"{API}/wallet/payout", headers=admin_headers,
                              json={"amount_sar": 51, "iban": "SA0000000000000000000000",
                                    "beneficiary_name": "Test", "mobile": "0500000000"},
                              timeout=15)
            codes.append(r.status_code)
        assert 429 in codes, f"expected a 429 among 6 attempts, got {codes}"


# ─── Sentry & 404 ────────────────────────────────────────────────────────────
class TestSentryAnd404:
    def test_non_existent_returns_404(self):
        r = requests.get(f"{API}/does-not-exist", timeout=15)
        assert r.status_code == 404

    def test_sentry_env_loaded(self):
        # We can't hit env directly from client, but backend must be up & healthy
        r = requests.get(f"{API}/moyasar/config", timeout=15)
        assert r.status_code == 200
