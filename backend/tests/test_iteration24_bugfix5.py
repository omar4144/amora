"""
Iteration 24 — 5-bug batch backend tests.
Covers:
  1. POST /api/workspace/recommendations
  2. DELETE /api/videos/{id} (owner, non-owner=403, non-existent=404, cascade)
  3. GET /api/users/{username}/followers  +  /following
  4. GET /api/admin/leads  (super_admin + status filter + 403)
  5. PUT /api/admin/leads/{id}/status  (valid, invalid, 404)
  6. Regression: POST /api/videos/{id}/comments works for another user
"""
import os
import io
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "crm@test.com"
ADMIN_PASS = "testpass123"


def _rand():
    return uuid.uuid4().hex[:8]


def _signup(email_prefix, name="Test User", role="creator"):
    ts = _rand()
    email = f"TEST_{email_prefix}_{ts}@test.com"
    username = f"test_{email_prefix}_{ts}"
    r = requests.post(f"{API}/auth/signup", json={
        "name": name, "username": username, "email": email,
        "password": "testpass123", "role": role,
    })
    assert r.status_code == 200, f"signup failed {r.status_code}: {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "username": username}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ── Fixtures ─────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def alice():
    return _signup("alice", "Alice")


@pytest.fixture(scope="module")
def bob():
    return _signup("bob", "Bob")


@pytest.fixture(scope="module")
def alice_video(alice):
    """Alice uploads a tiny video."""
    # Generate a minimal valid MP4 file blob (fake, doesn't need to be decodable)
    fake_mp4 = (
        b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
        + b"\x00" * 512
    )
    files = {
        "file": ("test.mp4", io.BytesIO(fake_mp4), "video/mp4"),
    }
    data = {"caption": "TEST_upload", "category": "عام"}
    r = requests.post(f"{API}/videos/upload", files=files, data=data, headers=_h(alice["token"]))
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    return r.json()


# ── 1. WORKSPACE RECOMMENDATIONS ────────────────────────────
class TestWorkspaceRecommendations:
    def test_recos_returns_200_with_list(self, alice):
        r = requests.post(f"{API}/workspace/recommendations", headers=_h(alice["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "recommendations" in data
        assert isinstance(data["recommendations"], list)

    def test_recos_unauth_401_or_403(self):
        r = requests.post(f"{API}/workspace/recommendations")
        assert r.status_code in (401, 403)


# ── 2. VIDEO DELETE ────────────────────────────────────────
class TestVideoDelete:
    def test_non_owner_gets_403(self, alice_video, bob):
        vid = alice_video["id"]
        r = requests.delete(f"{API}/videos/{vid}", headers=_h(bob["token"]))
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_non_existent_404(self, bob):
        r = requests.delete(f"{API}/videos/does-not-exist-abc123", headers=_h(bob["token"]))
        assert r.status_code == 404

    def test_owner_delete_cascades(self, alice, alice_video):
        vid = alice_video["id"]
        # Bob (created lazily via another test) comments first — but let's use alice for a self-comment to seed cascade
        cr = requests.post(f"{API}/videos/{vid}/comments", json={"text": "TEST_self"}, headers=_h(alice["token"]))
        assert cr.status_code == 200, cr.text
        # Alice likes
        lr = requests.post(f"{API}/videos/{vid}/like", headers=_h(alice["token"]))
        assert lr.status_code == 200
        # DELETE
        d = requests.delete(f"{API}/videos/{vid}", headers=_h(alice["token"]))
        assert d.status_code == 200, d.text
        assert d.json().get("deleted") is True
        # Stream should now 404 (soft delete)
        s = requests.get(f"{API}/videos/stream/{vid}")
        assert s.status_code == 404
        # Comments should be empty (cascade)
        gc = requests.get(f"{API}/videos/{vid}/comments")
        assert gc.status_code == 200
        assert gc.json() == []

    def test_super_admin_can_delete_any(self, admin_token, bob):
        """Bob uploads then super_admin deletes it."""
        fake_mp4 = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 256
        files = {"file": ("t.mp4", io.BytesIO(fake_mp4), "video/mp4")}
        r = requests.post(f"{API}/videos/upload", files=files, data={"caption": "TEST_bob", "category": "عام"},
                          headers=_h(bob["token"]))
        assert r.status_code == 200, r.text
        vid = r.json()["id"]
        d = requests.delete(f"{API}/videos/{vid}", headers=_h(admin_token))
        assert d.status_code == 200


# ── 3. FOLLOWERS / FOLLOWING ─────────────────────────────
class TestFollowersFollowing:
    def test_follow_then_list(self, alice, bob):
        # Bob follows Alice
        r = requests.post(f"{API}/users/{alice['username']}/follow", headers=_h(bob["token"]))
        assert r.status_code == 200
        # Alice followers list must contain Bob
        fr = requests.get(f"{API}/users/{alice['username']}/followers")
        assert fr.status_code == 200
        followers = fr.json()
        assert isinstance(followers, list)
        assert any(u["username"] == bob["username"] for u in followers), f"bob not in followers: {followers}"
        for u in followers:
            assert "id" in u and "username" in u and "name" in u
            assert "password" not in u

        # Bob's following list must contain Alice
        gr = requests.get(f"{API}/users/{bob['username']}/following")
        assert gr.status_code == 200
        following = gr.json()
        assert any(u["username"] == alice["username"] for u in following)

    def test_followers_unknown_user_404(self):
        r = requests.get(f"{API}/users/no_such_user_xyz_{_rand()}/followers")
        assert r.status_code == 404


# ── 4. ADMIN LEADS: LIST + FILTER + RBAC ──────────────────
class TestAdminLeads:
    @pytest.fixture(scope="class")
    def seed_lead(self):
        r = requests.post(f"{API}/leads", json={
            "name": "TEST Lead", "email": f"lead_{_rand()}@test.com",
            "story": "TEST_lead_story - Contact me please.",
        })
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_admin_list_leads(self, admin_token, seed_lead):
        r = requests.get(f"{API}/admin/leads", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        leads = r.json()
        assert isinstance(leads, list)
        assert any(l["id"] == seed_lead for l in leads)
        # Structure
        for l in leads[:5]:
            assert "id" in l and "name" in l and "email" in l and "status" in l

    def test_status_new_filter(self, admin_token, seed_lead):
        r = requests.get(f"{API}/admin/leads?status=new", headers=_h(admin_token))
        assert r.status_code == 200
        leads = r.json()
        assert all(l["status"] == "new" for l in leads)
        assert any(l["id"] == seed_lead for l in leads)

    def test_non_privileged_403(self, alice):
        r = requests.get(f"{API}/admin/leads", headers=_h(alice["token"]))
        assert r.status_code == 403


# ── 5. ADMIN LEAD STATUS UPDATE ──────────────────────────
class TestAdminLeadStatus:
    @pytest.fixture(scope="class")
    def lead_id(self):
        r = requests.post(f"{API}/leads", json={
            "name": "TEST StatusLead", "email": f"status_{_rand()}@test.com",
            "story": "TEST_status_lead",
        })
        assert r.status_code == 200
        return r.json()["id"]

    def test_valid_status_update(self, admin_token, lead_id):
        r = requests.put(f"{API}/admin/leads/{lead_id}/status",
                         json={"status": "in_review"}, headers=_h(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "in_review"
        # verify via GET
        gr = requests.get(f"{API}/admin/leads", headers=_h(admin_token))
        the_lead = next((l for l in gr.json() if l["id"] == lead_id), None)
        assert the_lead is not None
        assert the_lead["status"] == "in_review"

    def test_invalid_status_400(self, admin_token, lead_id):
        r = requests.put(f"{API}/admin/leads/{lead_id}/status",
                         json={"status": "bogus"}, headers=_h(admin_token))
        assert r.status_code == 400

    def test_non_existent_lead_404(self, admin_token):
        r = requests.put(f"{API}/admin/leads/does-not-exist-{_rand()}/status",
                         json={"status": "new"}, headers=_h(admin_token))
        assert r.status_code == 404


# ── 6. REGRESSION: comment on other user's video ──────────
class TestCommentRegression:
    def test_bob_can_comment_on_alice_video(self, alice, bob):
        # Fresh video for Alice
        fake_mp4 = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 256
        files = {"file": ("t.mp4", io.BytesIO(fake_mp4), "video/mp4")}
        r = requests.post(f"{API}/videos/upload", files=files, data={"caption": "TEST_alice2", "category": "عام"},
                          headers=_h(alice["token"]))
        assert r.status_code == 200
        vid = r.json()["id"]
        # Bob comments
        c = requests.post(f"{API}/videos/{vid}/comments", json={"text": "TEST bob comment"},
                          headers=_h(bob["token"]))
        assert c.status_code == 200, c.text
        assert c.json()["text"] == "TEST bob comment"
        # GET comments — verify persistence
        gc = requests.get(f"{API}/videos/{vid}/comments")
        assert gc.status_code == 200
        texts = [c["text"] for c in gc.json()]
        assert "TEST bob comment" in texts
