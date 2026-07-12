"""Phase 3 tests — Rebrand (Amora), avatar upload, communities create+search, teams/events, PDF branding."""
import io
import os
import uuid
import urllib.parse
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "crm@test.com", "password": "testpass123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# -------------------- Rebrand --------------------
class TestRebrand:
    def test_backend_title_is_amora(self, api):
        r = api.get(f"{BASE_URL}/api")
        assert r.status_code == 200
        assert r.json().get("app") == "Amora"


# -------------------- Teams / Events (bug) --------------------
class TestTeamsEvents:
    def test_teams_endpoint_returns_list(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/teams", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Ensure serializable
        for t in data[:5]:
            assert "id" in t or "slug" in t or "name" in t

    def test_events_endpoint_returns_list(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/events", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)


# -------------------- Avatar Upload --------------------
class TestAvatarUpload:
    def _make_png_bytes(self, size=(64, 64)):
        buf = io.BytesIO()
        Image.new("RGB", size, (200, 100, 50)).save(buf, format="PNG")
        return buf.getvalue()

    def test_upload_avatar_returns_avatar_url(self, api, auth_headers):
        img = self._make_png_bytes()
        files = {"file": ("avatar.png", img, "image/png")}
        r = api.post(f"{BASE_URL}/api/users/me/avatar", headers=auth_headers, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "avatar_url" in body
        assert isinstance(body["avatar_url"], str) and len(body["avatar_url"]) > 0

    def test_avatar_persisted_on_user(self, api, auth_headers):
        # upload first
        img = self._make_png_bytes()
        r = api.post(f"{BASE_URL}/api/users/me/avatar", headers=auth_headers,
                     files={"file": ("a.png", img, "image/png")})
        url = r.json()["avatar_url"]
        me = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me.status_code == 200
        assert me.json().get("avatar_url") == url

    def test_avatar_rejects_non_image(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/users/me/avatar", headers=auth_headers,
                     files={"file": ("a.txt", b"not-an-image", "text/plain")})
        assert r.status_code in (400, 415, 422), f"Expected reject, got {r.status_code}: {r.text}"


# -------------------- Communities --------------------
class TestCommunities:
    def test_create_community_arabic_slug(self, api, auth_headers):
        name = f"TEST_مصورو_{uuid.uuid4().hex[:6]}"
        r = api.post(f"{BASE_URL}/api/communities", headers=auth_headers,
                     json={"name": name, "description": "وصف تجريبي", "icon": "📷"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "slug" in body and body["slug"]
        assert body.get("joined") is True
        assert body.get("members_count") == 1
        # confirm retrievable
        slug = body["slug"]
        r2 = api.get(f"{BASE_URL}/api/communities/{slug}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["name"] == name

    def test_search_communities_q_filters(self, api, auth_headers):
        # create one with a known token
        token_str = f"amoraTEST{uuid.uuid4().hex[:6]}"
        api.post(f"{BASE_URL}/api/communities", headers=auth_headers,
                 json={"name": token_str, "description": "x"})
        q = urllib.parse.quote(token_str)
        r = api.get(f"{BASE_URL}/api/communities?q={q}", headers=auth_headers)
        assert r.status_code == 200
        results = r.json()
        assert any(token_str in c["name"] for c in results), f"Expected {token_str} in results"

    def test_list_communities_no_q(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/communities", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------------------- PDF branding --------------------
class TestInvoicePdfBranding:
    def test_invoice_pdf_does_not_contain_ruaa(self, api, auth_headers):
        # find any invoice
        r = api.get(f"{BASE_URL}/api/crm/invoices", headers=auth_headers)
        assert r.status_code == 200
        invs = r.json()
        if not invs:
            pytest.skip("No invoices to test PDF branding")
        inv_id = invs[0]["id"]
        r = api.get(f"{BASE_URL}/api/crm/invoices/{inv_id}/pdf", headers=auth_headers)
        assert r.status_code == 200
        content = r.content
        assert content[:4] == b"%PDF"
        # ensure old brand not present (case-insensitive)
        lower = content.lower()
        assert b"ru'ya" not in lower
        assert b"ruaa" not in lower
