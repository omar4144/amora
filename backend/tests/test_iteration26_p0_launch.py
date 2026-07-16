"""
P0 Launch Blockers regression tests — iteration 26.

Covers:
- /api/health
- Rate-limit on auth/login, auth/signup, leads
- File magic-bytes validation on avatar + video upload
- Moderation: /reports, /users/{u}/block, /admin/reports*
- Banned-user login rejection
"""
import io
import time
import uuid
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "crm@test.com"
SUPER_PASS = "testpass123"

# Unique IP per test-file run so we don't hit the 300/min default limit across suites
_IP_TAG = f"10.99.{int(time.time()) % 200}.{int(uuid.uuid4().int % 250)}"


def _ip_headers(offset: int = 0):
    """Fake X-Forwarded-For so rate-limit is scoped per test."""
    ip = f"10.99.{(int(time.time()) + offset) % 200}.{(offset * 37 + 3) % 250}"
    return {"X-Forwarded-For": ip}


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS},
                      headers=_ip_headers(1))
    assert r.status_code == 200, f"super_admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def creator_a():
    """Create a fresh creator user 'A'."""
    ts = int(time.time() * 1000)
    email = f"TEST_p0a_{ts}@test.com"
    username = f"testp0a_{ts}"
    r = requests.post(f"{API}/auth/signup", headers=_ip_headers(11), json={
        "name": "TEST A", "username": username, "email": email, "password": "testpass123"
    })
    assert r.status_code == 200, r.text
    return {"token": r.json()["token"], "user": r.json()["user"], "email": email, "username": username}


@pytest.fixture(scope="session")
def creator_b():
    ts = int(time.time() * 1000) + 1
    email = f"TEST_p0b_{ts}@test.com"
    username = f"testp0b_{ts}"
    r = requests.post(f"{API}/auth/signup", headers=_ip_headers(12), json={
        "name": "TEST B", "username": username, "email": email, "password": "testpass123"
    })
    assert r.status_code == 200, r.text
    return {"token": r.json()["token"], "user": r.json()["user"], "email": email, "username": username}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ==================== HEALTH ====================
class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        j = r.json()
        assert j.get("status") == "ok"
        assert j.get("db") == "up"
        assert "ts" in j


# ==================== RATE LIMITS ====================
class TestRateLimits:
    def test_login_rate_limit(self):
        h = _ip_headers(100)
        codes = []
        for i in range(12):
            r = requests.post(f"{API}/auth/login",
                              json={"email": "nobody@example.com", "password": "wrong"},
                              headers=h)
            codes.append(r.status_code)
        # 10 allowed → 401; 11th+ → 429
        assert 429 in codes, f"Expected 429 in codes, got {codes}"
        first_429 = codes.index(429)
        assert first_429 >= 10, f"429 arrived too early at index {first_429}: {codes}"

    def test_signup_rate_limit(self):
        h = _ip_headers(200)
        codes = []
        for i in range(7):
            ts = int(time.time() * 1000) + i
            r = requests.post(f"{API}/auth/signup", headers=h, json={
                "name": "rl", "username": f"rl_{ts}_{i}",
                "email": f"TEST_rl_{ts}_{i}@test.com", "password": "testpass123"
            })
            codes.append(r.status_code)
        assert 429 in codes, f"Expected 429, got {codes}"
        first_429 = codes.index(429)
        assert first_429 >= 5, f"429 arrived too early at index {first_429}: {codes}"

    def test_leads_rate_limit(self):
        h = _ip_headers(300)
        codes = []
        for i in range(5):
            r = requests.post(f"{API}/leads", headers=h, json={
                "name": f"TEST_rl_{i}", "email": f"lead_{i}@test.com",
                "story": "test story from rate limit test"
            })
            codes.append(r.status_code)
        assert 429 in codes, f"Expected 429, got {codes}"
        first_429 = codes.index(429)
        assert first_429 >= 3, f"429 arrived too early at index {first_429}: {codes}"


# ==================== FILE MAGIC-BYTES ====================
class TestMagicBytes:
    def test_video_upload_rejects_fake_mp4(self, creator_a):
        files = {
            "file": ("fake.mp4", io.BytesIO(b"this is plain text, not a video"), "video/mp4"),
        }
        data = {"caption": "TEST_p0_fake", "category": "عام"}
        r = requests.post(f"{API}/videos/upload",
                          headers={**_auth(creator_a["token"]), **_ip_headers(400)},
                          files=files, data=data)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        assert "صيغة" in detail or "غير مدعومة" in detail, f"expected Arabic error, got: {detail}"

    def test_avatar_upload_rejects_fake_jpg(self, creator_a):
        files = {"file": ("fake.jpg", io.BytesIO(b"just some text bytes"), "image/jpeg")}
        r = requests.post(f"{API}/users/me/avatar",
                          headers={**_auth(creator_a["token"]), **_ip_headers(401)},
                          files=files)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        assert "صيغة" in detail or "غير مدعومة" in detail, f"expected Arabic error, got: {detail}"


# ==================== MODERATION META ====================
class TestModerationMeta:
    def test_meta_shape(self):
        r = requests.get(f"{API}/moderation/meta")
        assert r.status_code == 200
        j = r.json()
        assert "target_types" in j and "reasons" in j
        assert set(j["target_types"]) == {"video", "user", "comment", "message", "service", "community_post"}
        keys = [x["key"] for x in j["reasons"]]
        assert len(keys) == 9
        for expected in ["spam", "harassment", "hate_speech", "nudity", "violence",
                         "misinformation", "copyright", "scam", "other"]:
            assert expected in keys


# ==================== REPORTS ====================
class TestReports:
    def test_create_report_success(self, creator_a, creator_b):
        target = str(uuid.uuid4())  # fake video id, moderation is permissive on existence
        r = requests.post(f"{API}/reports",
                          headers={**_auth(creator_a["token"]), **_ip_headers(500)},
                          json={"target_type": "video", "target_id": target,
                                "reason": "spam", "details": "TEST_p0 spam report"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert "report_id" in j
        self._report_id = j["report_id"]
        pytest.report_id_cache = j["report_id"]
        pytest.report_target_id = target

    def test_duplicate_report_conflict(self, creator_a):
        target = getattr(pytest, "report_target_id", None)
        assert target, "prev test did not set target"
        r = requests.post(f"{API}/reports",
                          headers={**_auth(creator_a["token"]), **_ip_headers(501)},
                          json={"target_type": "video", "target_id": target,
                                "reason": "spam"})
        assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"

    def test_invalid_target_type(self, creator_a):
        r = requests.post(f"{API}/reports",
                          headers={**_auth(creator_a["token"]), **_ip_headers(502)},
                          json={"target_type": "nonsense", "target_id": "x",
                                "reason": "spam"})
        assert r.status_code == 400

    def test_invalid_reason(self, creator_a):
        r = requests.post(f"{API}/reports",
                          headers={**_auth(creator_a["token"]), **_ip_headers(503)},
                          json={"target_type": "video", "target_id": str(uuid.uuid4()),
                                "reason": "not_a_reason"})
        assert r.status_code == 400

    def test_my_reports_requires_auth(self):
        r = requests.get(f"{API}/reports/me", headers=_ip_headers(504))
        assert r.status_code in (401, 403)

    def test_my_reports_ok(self, creator_a):
        r = requests.get(f"{API}/reports/me",
                         headers={**_auth(creator_a["token"]), **_ip_headers(505)})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(x["reporter_id"] == creator_a["user"]["id"] for x in rows)


# ==================== BLOCKS ====================
class TestBlocks:
    def test_block_success(self, creator_a, creator_b):
        r = requests.post(f"{API}/users/{creator_b['username']}/block",
                          headers={**_auth(creator_a["token"]), **_ip_headers(600)})
        assert r.status_code == 200, r.text
        assert r.json().get("blocked") is True

    def test_self_block_rejected(self, creator_a):
        r = requests.post(f"{API}/users/{creator_a['username']}/block",
                          headers={**_auth(creator_a["token"]), **_ip_headers(601)})
        assert r.status_code == 400

    def test_block_unknown_user(self, creator_a):
        r = requests.post(f"{API}/users/no_such_user_xyz_p0/block",
                          headers={**_auth(creator_a["token"]), **_ip_headers(602)})
        assert r.status_code == 404

    def test_my_blocks_list(self, creator_a, creator_b):
        r = requests.get(f"{API}/users/me/blocks",
                         headers={**_auth(creator_a["token"]), **_ip_headers(603)})
        assert r.status_code == 200
        j = r.json()
        assert "blocks" in j and "users" in j
        assert any(u.get("username") == creator_b["username"] for u in j["users"])

    def test_unblock(self, creator_a, creator_b):
        r = requests.delete(f"{API}/users/{creator_b['username']}/block",
                            headers={**_auth(creator_a["token"]), **_ip_headers(604)})
        assert r.status_code == 200
        assert r.json().get("blocked") is False


# ==================== ADMIN REPORTS ====================
class TestAdminReports:
    def test_admin_list_reports(self, super_token):
        r = requests.get(f"{API}/admin/reports?status=pending",
                         headers={**_auth(super_token), **_ip_headers(700)})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # If any exist, they should have a reporter enriched
        if rows:
            sample = rows[0]
            assert "reporter_id" in sample
            # reporter should be attached (or None if user missing)
            assert "reporter" in sample

    def test_admin_stats(self, super_token):
        r = requests.get(f"{API}/admin/reports/stats",
                         headers={**_auth(super_token), **_ip_headers(701)})
        assert r.status_code == 200
        j = r.json()
        for k in ("total", "pending", "under_review", "resolved", "dismissed"):
            assert k in j, f"missing key {k}"
            assert isinstance(j[k], int)

    def test_admin_forbidden_for_non_privileged(self, creator_a):
        r = requests.get(f"{API}/admin/reports",
                         headers={**_auth(creator_a["token"]), **_ip_headers(702)})
        assert r.status_code == 403

    def test_admin_resolve_report(self, super_token, creator_b):
        # Create a fresh report from creator_b that admin can resolve
        target_video_id = str(uuid.uuid4())
        # Insert a fake video that admin can mark deleted (so we can assert action)
        # Use a report on 'video' target
        r = requests.post(f"{API}/reports",
                          headers={**_auth(creator_b["token"]), **_ip_headers(703)},
                          json={"target_type": "video", "target_id": target_video_id,
                                "reason": "harassment", "details": "TEST_p0 resolve"})
        assert r.status_code == 200, r.text
        report_id = r.json()["report_id"]

        r2 = requests.put(f"{API}/admin/reports/{report_id}",
                          headers={**_auth(super_token), **_ip_headers(704)},
                          json={"status": "resolved", "action": "content_removed",
                                "admin_notes": "TEST_p0 resolved"})
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j.get("status") == "resolved"


# ==================== BANNED LOGIN ====================
class TestBannedLogin:
    def test_banned_user_rejected(self, super_token):
        # Create a fresh user, ban them via admin API, then try to login
        ts = int(time.time() * 1000)
        email = f"TEST_ban_{ts}@test.com"
        r = requests.post(f"{API}/auth/signup", headers=_ip_headers(800), json={
            "name": "ban", "username": f"ban_{ts}", "email": email, "password": "testpass123"
        })
        assert r.status_code == 200
        uid = r.json()["user"]["id"]

        # Ban via admin
        rb = requests.put(f"{API}/admin/users/{uid}/ban",
                          headers={**_auth(super_token), **_ip_headers(801)},
                          json={"banned": True, "reason": "TEST_p0"})
        # accept either 200 or 204 semantics
        assert rb.status_code in (200, 204), f"ban failed: {rb.status_code} {rb.text}"

        # login should now be 403 with Arabic message
        rl = requests.post(f"{API}/auth/login",
                           headers=_ip_headers(802),
                           json={"email": email, "password": "testpass123"})
        assert rl.status_code == 403, f"expected 403, got {rl.status_code} {rl.text}"
        detail = rl.json().get("detail", "")
        assert "إيقاف" in detail or "حساب" in detail, f"expected Arabic ban msg, got: {detail}"
