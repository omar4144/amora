"""Iteration 29 — Backend tests for Feed redesign (enrich_video, following feed, save/unsave/saved list)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "crm@test.com", "password": "testpass123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def admin_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def user_b():
    """A fresh signup used as a follower/liker."""
    ts = int(time.time() * 1000)
    payload = {
        "name": "TEST_it29_userB",
        "username": f"TEST_it29_uB_{ts}",
        "email": f"TEST_it29_uB_{ts}@test.com",
        "password": "testpass123",
        "role": "creator",
    }
    r = requests.post(f"{API}/auth/signup", json=payload)
    assert r.status_code in (200, 201), r.text
    tok = r.json()["token"]
    me = r.json()["user"]
    return {"token": tok, "user": me, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def any_video(admin_headers):
    r = requests.get(f"{API}/videos/feed", headers=admin_headers)
    assert r.status_code == 200, r.text
    videos = r.json()
    if not videos:
        pytest.skip("No videos in the feed — cannot run video-level tests")
    return videos[0]


# ---------- 1. GET /videos/feed enrichment ----------
class TestFeedEnrichment:
    def test_feed_returns_list(self, admin_headers):
        r = requests.get(f"{API}/videos/feed", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed_item_shape(self, any_video):
        v = any_video
        # Required top-level keys
        for k in ["id", "user_id", "caption", "likes", "views", "created_at"]:
            assert k in v, f"missing {k} in feed item"
        # New enrichment keys from iteration 29
        assert "creator" in v, "creator not attached"
        assert "primary_service" in v, "primary_service key missing (must be present, may be null)"
        assert "liked" in v
        assert "saved" in v
        assert isinstance(v["liked"], bool)
        assert isinstance(v["saved"], bool)

    def test_creator_stats(self, any_video):
        c = any_video["creator"]
        assert c is not None, "creator was None"
        # stats fields must exist
        assert "orders_count" in c
        assert isinstance(c["orders_count"], int)
        # rating: float or None
        assert "rating" in c
        assert c["rating"] is None or isinstance(c["rating"], (int, float))
        assert "reviews_count" in c
        assert isinstance(c["reviews_count"], int)
        # never expose password
        assert "password" not in c

    def test_feed_no_mongo_id(self, any_video):
        assert "_id" not in any_video
        if any_video.get("creator"):
            assert "_id" not in any_video["creator"]


# ---------- 2. GET /videos/feed/following ----------
class TestFollowingFeed:
    def test_requires_auth(self):
        r = requests.get(f"{API}/videos/feed/following")
        assert r.status_code in (401, 403)

    def test_empty_when_following_nobody(self, user_b):
        r = requests.get(f"{API}/videos/feed/following", headers=user_b["headers"])
        assert r.status_code == 200
        # user_b is a brand new user who follows nobody → []
        assert r.json() == []

    def test_returns_videos_after_following(self, user_b, admin_me):
        # follow the admin (crm_tester)
        f = requests.post(f"{API}/users/{admin_me['username']}/follow", headers=user_b["headers"])
        assert f.status_code == 200
        r = requests.get(f"{API}/videos/feed/following", headers=user_b["headers"])
        assert r.status_code == 200
        vids = r.json()
        # If crm_tester has videos, we should see them; otherwise still [] is acceptable
        for v in vids:
            assert v["user_id"] == admin_me["id"]
            assert "primary_service" in v
            assert "creator" in v


# ---------- 3. Save / Unsave / saved list ----------
class TestSaveVideo:
    def test_save_requires_auth(self, any_video):
        r = requests.post(f"{API}/videos/{any_video['id']}/save")
        assert r.status_code in (401, 403)

    def test_save_and_idempotent(self, any_video, user_b):
        r1 = requests.post(f"{API}/videos/{any_video['id']}/save", headers=user_b["headers"])
        assert r1.status_code == 200, r1.text
        assert r1.json().get("saved") is True
        # second call: already
        r2 = requests.post(f"{API}/videos/{any_video['id']}/save", headers=user_b["headers"])
        assert r2.status_code == 200
        j = r2.json()
        assert j.get("saved") is True
        assert j.get("already") is True

    def test_saved_list_includes_video(self, any_video, user_b):
        r = requests.get(f"{API}/videos/saved", headers=user_b["headers"])
        assert r.status_code == 200
        ids = [v["id"] for v in r.json()]
        assert any_video["id"] in ids
        # ensure enrichment on saved list too
        for v in r.json():
            assert "primary_service" in v
            assert "creator" in v
            assert v.get("saved") is True

    def test_saved_flag_in_feed(self, any_video, user_b):
        # after save, feed must show saved=true for that video
        r = requests.get(f"{API}/videos/feed", headers=user_b["headers"])
        assert r.status_code == 200
        for v in r.json():
            if v["id"] == any_video["id"]:
                assert v["saved"] is True
                break
        else:
            pytest.skip("Video not present in feed (paged?)")

    def test_unsave(self, any_video, user_b):
        r = requests.delete(f"{API}/videos/{any_video['id']}/save", headers=user_b["headers"])
        assert r.status_code == 200
        j = r.json()
        assert j.get("saved") is False
        assert j.get("removed") is True

    def test_save_nonexistent_video(self, user_b):
        r = requests.post(f"{API}/videos/does-not-exist/save", headers=user_b["headers"])
        assert r.status_code == 404


# ---------- 4. primary_service enrichment ----------
class TestPrimaryService:
    def test_primary_service_present_when_creator_has_service(self, admin_headers, admin_me):
        # Create a service for the admin if none exists
        payload = {
            "title": "TEST_it29_headline_service",
            "description": "Test service for iteration 29",
            "price": 100.0,
            "delivery_days": 3,
        }
        # try create (idempotent-ish by title check)
        existing = requests.get(f"{API}/services/user/{admin_me['username']}").json()
        if not any(s.get("title") == payload["title"] for s in existing):
            cr = requests.post(f"{API}/services", json=payload, headers=admin_headers)
            assert cr.status_code in (200, 201), cr.text

        # Now fetch feed and find at least one of admin's videos → primary_service should be set
        r = requests.get(f"{API}/videos/feed", headers=admin_headers)
        assert r.status_code == 200
        admin_videos = [v for v in r.json() if v["user_id"] == admin_me["id"]]
        if not admin_videos:
            pytest.skip("Admin has no videos to attach primary_service to")
        # AT LEAST ONE of admin's videos should carry a non-null primary_service
        with_svc = [v for v in admin_videos if v.get("primary_service")]
        assert with_svc, (
            "primary_service is None for ALL admin videos even though a service exists — "
            "likely engine mismatch (services stored with user_id but enrich_video queries seller_id)."
        )
        svc = with_svc[0]["primary_service"]
        assert "title" in svc
        assert "price" in svc
