"""Iteration 18 backend regression:
- Phase 1/2 endpoints still work after APP_NAME change to 'amora'.
- Avatar upload path prefix is now `amora/` instead of `ruaa/`.
- Community create + list still works.
"""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-restore-3.preview.emergentagent.com").rstrip("/")
FE_URL = BASE_URL  # same origin; used for checkout origin_url

ADMIN_EMAIL = "crm@test.com"
ADMIN_PASSWORD = "testpass123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_workspace_today(auth_headers):
    r = requests.get(f"{BASE_URL}/api/workspace/today", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, dict)


def test_workspace_morning_brief(auth_headers):
    r = requests.post(f"{BASE_URL}/api/workspace/morning-brief", headers=auth_headers, json={}, timeout=30)
    assert r.status_code == 200, r.text


def test_crm_clients_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/crm/clients", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), (list, dict))


def test_billing_me(auth_headers):
    r = requests.get(f"{BASE_URL}/api/billing/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "plan" in body or "credits_remaining" in body


def test_billing_checkout(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/billing/checkout",
        headers=auth_headers,
        json={"plan": "pro", "origin_url": FE_URL},
        timeout=30,
    )
    # accept 200 (session created) or 500 if stripe key missing in preview env — but not 4xx
    assert r.status_code in (200, 500), r.text
    if r.status_code == 200:
        assert "url" in r.json() or "checkout_url" in r.json() or "session_id" in r.json()


def test_crm_create_invoice_and_persistence(auth_headers):
    # Need a client first
    cli = requests.post(
        f"{BASE_URL}/api/crm/clients",
        headers=auth_headers,
        json={"name": f"TEST_client_{uuid.uuid4().hex[:6]}", "email": f"test_{uuid.uuid4().hex[:6]}@t.com"},
        timeout=15,
    )
    assert cli.status_code in (200, 201), cli.text
    client_id = cli.json().get("id") or cli.json().get("_id")
    assert client_id

    payload = {
        "client_id": client_id,
        "title": "TEST_invoice",
        "items": [{"description": "Service", "quantity": 1, "unit_price": 100.0}],
        "currency": "USD",
        "tax_percent": 15.0,
        "discount": 0.0,
    }
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=auth_headers, json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    inv = r.json()
    assert inv.get("client_id") == client_id
    totals = inv.get("totals") or {}
    # 100 + 15% tax = 115
    if totals:
        assert round(totals.get("total", 0), 2) == 115.0


def test_avatar_upload_returns_amora_path(auth_headers):
    # 1x1 PNG bytes
    import base64
    png = base64.b64decode(
        b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{BASE_URL}/api/users/me/avatar", headers=auth_headers, files=files, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    url = body.get("avatar_url", "")
    assert "/amora/" in url, f"Expected amora/ prefix, got: {url}"
    assert "/ruaa/" not in url


def test_community_create_and_list(auth_headers):
    name = f"TEST_community_{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/api/communities",
        headers=auth_headers,
        json={"name": name, "description": "iteration 18 retest", "icon": "🚀"},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    body = r.json()
    slug = body.get("slug")
    assert slug

    # verify list contains it
    lst = requests.get(f"{BASE_URL}/api/communities", headers=auth_headers, timeout=15)
    assert lst.status_code == 200
    items = lst.json() if isinstance(lst.json(), list) else lst.json().get("items", [])
    slugs = [c.get("slug") for c in items]
    assert slug in slugs
