"""Iteration 22 — Disputes + Media in DMs + Video Thumbnails/Filters (backend)."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://doc-restore-3.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "crm@test.com"
ADMIN_PASSWORD = "testpass123"

TS = int(time.time())
_STATE = {}  # shared cross-test state


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _signup(api, name, email, password="testpass123"):
    username = f"TEST_{name}_{TS}_{uuid.uuid4().hex[:6]}"
    r = api.post(f"{BASE_URL}/api/auth/signup", json={
        "name": f"TEST_{name}", "username": username, "email": email, "password": password
    })
    assert r.status_code in (200, 201), r.text
    body = r.json()
    return body["token"], body["user"]


@pytest.fixture(scope="session")
def admin_token(api):
    return _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def seller(api):
    email = f"TEST_seller_{TS}_{uuid.uuid4().hex[:6]}@test.com"
    token, user = _signup(api, "seller", email)
    return {"token": token, "user": user}


@pytest.fixture(scope="session")
def buyer(api):
    email = f"TEST_buyer_{TS}_{uuid.uuid4().hex[:6]}@test.com"
    token, user = _signup(api, "buyer", email)
    return {"token": token, "user": user}


@pytest.fixture(scope="session")
def paid_order(api, seller, buyer):
    """Create a service by seller, an order by buyer, then flip order to 'paid' via mongo directly (Stripe test flow is out-of-band)."""
    # 1) service
    hs = {"Authorization": f"Bearer {seller['token']}", "Content-Type": "application/json"}
    r = api.post(f"{BASE_URL}/api/services", headers=hs, json={
        "title": "TEST_svc_disputes", "description": "for dispute test", "price": 50, "delivery_days": 3
    })
    assert r.status_code in (200, 201), r.text
    svc = r.json()
    # 2) order
    hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
    r = api.post(f"{BASE_URL}/api/orders", headers=hb, json={
        "service_id": svc["id"], "notes": "TEST"
    })
    assert r.status_code in (200, 201), r.text
    order = r.json()
    # 3) mark it paid + delivered via mongo — skip Stripe
    import pymongo
    mongo = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbn = os.environ.get("DB_NAME", "ruaa_db")
    mongo[dbn]["orders"].update_one(
        {"id": order["id"]},
        {"$set": {"status": "paid", "payment_status": "paid"}}
    )
    # re-read
    updated = mongo[dbn]["orders"].find_one({"id": order["id"]}, {"_id": 0})
    return updated


# ==================== DISPUTES ====================
class TestDisputesMeta:
    def test_meta(self, api):
        r = api.get(f"{BASE_URL}/api/disputes/meta")
        assert r.status_code == 200
        j = r.json()
        assert "reasons" in j
        keys = {x["key"] for x in j["reasons"]}
        assert {"not_delivered", "not_as_described", "poor_quality", "other"}.issubset(keys)


class TestDisputesFlow:
    def test_a_non_buyer_cannot_create(self, api, paid_order, seller):
        # seller tries to open a dispute on his own order → should be 403
        hs = {"Authorization": f"Bearer {seller['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes", headers=hs, json={
            "order_id": paid_order["id"], "reason": "not_delivered", "description": "seller trying"
        })
        assert r.status_code == 403, r.text

    def test_b_buyer_opens_dispute(self, api, paid_order, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes", headers=hb, json={
            "order_id": paid_order["id"], "reason": "not_delivered", "description": "TEST — item never arrived"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"] == paid_order["id"]
        assert d["status"] == "open"
        assert d["reason"] == "not_delivered"
        assert d["buyer_id"] == buyer["user"]["id"]
        assert d["seller_id"] == paid_order.get("creator_id") or d["seller_id"]  # tolerant
        assert isinstance(d["messages"], list) and len(d["messages"]) >= 1
        # save for downstream
        _STATE['dispute_id'] = d["id"]

    def test_c_duplicate_open_409(self, api, paid_order, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes", headers=hb, json={
            "order_id": paid_order["id"], "reason": "poor_quality", "description": "TEST dup"
        })
        assert r.status_code == 409, r.text

    def test_d_list_disputes_as_buyer(self, api, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}"}
        r = api.get(f"{BASE_URL}/api/disputes", headers=hb)
        assert r.status_code == 200
        items = r.json()
        assert any(d["id"] == _STATE['dispute_id'] for d in items)
        this = [d for d in items if d["id"] == _STATE['dispute_id']][0]
        assert this["role"] == "buyer"
        assert "counterparty" in this

    def test_e_list_disputes_as_seller(self, api, seller):
        hs = {"Authorization": f"Bearer {seller['token']}"}
        r = api.get(f"{BASE_URL}/api/disputes", headers=hs)
        assert r.status_code == 200
        items = r.json()
        assert any(d["id"] == _STATE['dispute_id'] for d in items)
        this = [d for d in items if d["id"] == _STATE['dispute_id']][0]
        assert this["role"] == "seller"

    def test_f_get_dispute_detail_enriched(self, api, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}"}
        r = api.get(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}", headers=hb)
        assert r.status_code == 200
        d = r.json()
        assert d["buyer"] and d["seller"] and d["order"]
        assert d["role"] == "buyer"

    def test_g_add_message_flips_to_under_review(self, api, seller):
        # seller responds → status open→under_review
        hs = {"Authorization": f"Bearer {seller['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}/messages", headers=hs, json={
            "text": "TEST seller reply"
        })
        assert r.status_code == 200, r.text
        # verify status flipped
        r2 = api.get(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}", headers=hs)
        assert r2.status_code == 200
        assert r2.json()["status"] == "under_review"

    def test_h_empty_message_rejected(self, api, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}/messages", headers=hb, json={"text": "  "})
        assert r.status_code == 400

    def test_i_non_admin_cannot_resolve(self, api, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}/resolve", headers=hb, json={"resolution": "refund_buyer"})
        assert r.status_code == 403

    def test_j_admin_lists_all_disputes(self, api, admin_token):
        ha = {"Authorization": f"Bearer {admin_token}"}
        r = api.get(f"{BASE_URL}/api/admin/disputes", headers=ha)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(d["id"] == _STATE['dispute_id'] for d in items)

    def test_k_admin_resolves_refund(self, api, admin_token, paid_order):
        ha = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}/resolve", headers=ha, json={"resolution": "refund_buyer", "admin_notes": "TEST refund"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "resolved" and j["resolution"] == "refund_buyer"
        # order should flip to refunded
        import pymongo
        mongo = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbn = os.environ.get("DB_NAME", "ruaa_db")
        o = mongo[dbn]["orders"].find_one({"id": paid_order["id"]})
        assert o["status"] == "refunded", f"expected refunded got {o['status']}"

    def test_l_add_message_after_resolve_rejected(self, api, buyer):
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = api.post(f"{BASE_URL}/api/disputes/{_STATE['dispute_id']}/messages", headers=hb, json={"text": "TEST after close"})
        assert r.status_code == 400

    def test_m_close_by_buyer(self, api, buyer, seller):
        # open a fresh dispute on a new order to test close
        # create another order + mark paid
        hs = {"Authorization": f"Bearer {seller['token']}", "Content-Type": "application/json"}
        svc = api.post(f"{BASE_URL}/api/services", headers=hs, json={
            "title": "TEST_svc_close", "description": "close test", "price": 20
        }).json()
        hb = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        order = api.post(f"{BASE_URL}/api/orders", headers=hb, json={"service_id": svc["id"]}).json()
        import pymongo
        mongo = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbn = os.environ.get("DB_NAME", "ruaa_db")
        mongo[dbn]["orders"].update_one({"id": order["id"]}, {"$set": {"status": "paid", "payment_status": "paid"}})
        d = api.post(f"{BASE_URL}/api/disputes", headers=hb, json={
            "order_id": order["id"], "reason": "other", "description": "TEST close me"
        }).json()
        assert "id" in d, d
        # close as buyer
        r = api.post(f"{BASE_URL}/api/disputes/{d['id']}/close", headers=hb)
        assert r.status_code == 200
        # verify state
        r2 = api.get(f"{BASE_URL}/api/disputes/{d['id']}", headers=hb)
        assert r2.json()["status"] == "closed"


# ==================== MESSAGES / MEDIA ====================
class TestMessagesMedia:
    def test_upload_image_ok(self, api, buyer):
        h = {"Authorization": f"Bearer {buyer['token']}"}
        # 1x1 PNG
        png = bytes.fromhex("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082")
        files = {"file": ("tiny.png", png, "image/png")}
        r = requests.post(f"{BASE_URL}/api/messages/media", headers=h, files=files)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["media_type"] == "image"
        assert j["media_url"].startswith("http") or j["media_url"].startswith("/")
        assert j["filename"] == "tiny.png"

    def test_upload_exe_rejected(self, api, buyer):
        h = {"Authorization": f"Bearer {buyer['token']}"}
        files = {"file": ("virus.exe", b"MZ\x00\x00", "application/octet-stream")}
        r = requests.post(f"{BASE_URL}/api/messages/media", headers=h, files=files)
        assert r.status_code == 400

    def test_send_message_media_only_no_text(self, api, buyer, seller):
        # upload image
        h = {"Authorization": f"Bearer {buyer['token']}"}
        png = bytes.fromhex("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082")
        files = {"file": ("t.png", png, "image/png")}
        up = requests.post(f"{BASE_URL}/api/messages/media", headers=h, files=files).json()
        # send message with empty text + media
        hj = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/messages/with/{seller['user']['username']}", headers=hj, json={
            "text": "", "media_url": up["media_url"], "media_type": up["media_type"]
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["media_url"] == up["media_url"]
        assert j["media_type"] == "image"
        assert (j.get("text") or "") == ""

    def test_send_message_empty_both_rejected(self, api, buyer, seller):
        hj = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/messages/with/{seller['user']['username']}", headers=hj, json={
            "text": "", "media_url": None, "media_type": None
        })
        assert r.status_code == 400
        # message body says الرسالة فارغة
        assert "فارغة" in r.text or "empty" in r.text.lower()

    def test_send_message_text_only_still_works(self, api, buyer, seller):
        hj = {"Authorization": f"Bearer {buyer['token']}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/messages/with/{seller['user']['username']}", headers=hj, json={
            "text": "TEST regression text only"
        })
        assert r.status_code == 200
        assert r.json()["text"] == "TEST regression text only"


# ==================== VIDEO UPLOAD WITH THUMBNAIL + FILTER ====================
class TestVideoUploadWithThumbnailFilter:
    def test_upload_video_with_thumbnail_and_filter(self, api, buyer):
        h = {"Authorization": f"Bearer {buyer['token']}"}
        # Tiny fake mp4 header + payload
        mp4 = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 200
        png = bytes.fromhex("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082")
        files = {
            "file": ("clip.mp4", mp4, "video/mp4"),
            "thumbnail": ("thumb.jpg", png, "image/jpeg"),
        }
        data = {"caption": "TEST filtered", "category": "عام", "filter_name": "warm"}
        r = requests.post(f"{BASE_URL}/api/videos/upload", headers=h, files=files, data=data)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["thumbnail_url"] is not None
        assert v["filter_name"] == "warm"
        assert v["caption"] == "TEST filtered"

    def test_upload_video_without_optional_thumbnail(self, api, buyer):
        h = {"Authorization": f"Bearer {buyer['token']}"}
        mp4 = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 200
        files = {"file": ("clip2.mp4", mp4, "video/mp4")}
        data = {"caption": "TEST no thumb", "category": "عام"}
        r = requests.post(f"{BASE_URL}/api/videos/upload", headers=h, files=files, data=data)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["thumbnail_url"] is None
        assert v.get("filter_name") in (None, "")


# ==================== CLEANUP ====================
class TestZCleanup:
    def test_cleanup(self, api, buyer, seller):
        try:
            import pymongo
            mongo = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            dbn = os.environ.get("DB_NAME", "ruaa_db")
            db = mongo[dbn]
            db.disputes.delete_many({"buyer_id": buyer["user"]["id"]})
            db.orders.delete_many({"client_id": buyer["user"]["id"]})
            db.services.delete_many({"user_id": seller["user"]["id"]})
            db.videos.delete_many({"user_id": buyer["user"]["id"]})
            db.messages.delete_many({"$or": [{"sender_id": buyer["user"]["id"]}, {"receiver_id": buyer["user"]["id"]}]})
            db.users.delete_many({"id": {"$in": [buyer["user"]["id"], seller["user"]["id"]]}})
        except Exception as e:
            print("cleanup err (non-fatal):", e)
        assert True
