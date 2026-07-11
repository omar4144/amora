#!/usr/bin/env python3
"""
Iteration 7 Backend Tests - Focused regression + new /api/leads endpoint
"""
import requests
import json
import uuid

BASE = "https://f4c8f2f1-4587-4442-842d-9074b7d8c5fd.preview.emergentagent.com/api"

results = {"passed": [], "failed": []}

def log(name, ok, detail=""):
    if ok:
        results["passed"].append(name)
        print(f"✅ [PASS] {name} {detail}")
    else:
        results["failed"].append({"test": name, "detail": detail})
        print(f"❌ [FAIL] {name} {detail}")

print("=" * 80)
print("ITERATION 7 - Backend Testing")
print("=" * 80)

# ==================== NEW: LEADS ENDPOINT ====================
print("\n[1] Testing NEW /api/leads endpoint...")

# Test 1: POST /api/leads with valid data
print("\n  → POST /api/leads with valid data...")
r = requests.post(f"{BASE}/leads", json={
    "name": "Ali",
    "email": "ali@example.com",
    "story": "I want to build my brand story"
})
if r.status_code == 200:
    j = r.json()
    ok = j.get("success") is True and "id" in j and isinstance(j["id"], str)
    log("leads_post_valid", ok, f"response={j}")
else:
    log("leads_post_valid", False, f"status={r.status_code} body={r.text[:200]}")

# Test 2: POST /api/leads with invalid email
print("\n  → POST /api/leads with invalid email...")
r = requests.post(f"{BASE}/leads", json={
    "name": "Test",
    "email": "not-an-email",
    "story": "Some story"
})
log("leads_post_invalid_email", r.status_code == 422, f"status={r.status_code}")

# Test 3: POST /api/leads with missing field (no story)
print("\n  → POST /api/leads with missing field...")
r = requests.post(f"{BASE}/leads", json={
    "name": "Test",
    "email": "test@example.com"
})
log("leads_post_missing_field", r.status_code == 422, f"status={r.status_code}")

# Test 4: GET /api/leads without Authorization header
print("\n  → GET /api/leads without auth...")
r = requests.get(f"{BASE}/leads")
log("leads_get_no_auth", r.status_code in [401, 403], f"status={r.status_code}")

# Test 5: GET /api/leads with non-admin token
print("\n  → Creating fresh user for non-admin test...")
uid = uuid.uuid4().hex[:8]
signup_email = f"testuser_{uid}@test.com"
r = requests.post(f"{BASE}/auth/signup", json={
    "email": signup_email,
    "password": "testpass123",
    "name": "Test User",
    "username": f"testuser_{uid}"
})
if r.status_code == 200:
    non_admin_token = r.json().get("token")
    print(f"    Created user: {signup_email}")
    
    print("\n  → GET /api/leads with non-admin token...")
    r = requests.get(f"{BASE}/leads", headers={"Authorization": f"Bearer {non_admin_token}"})
    if r.status_code == 403:
        detail = r.json().get("detail", "")
        ok = detail == "غير مصرح"
        log("leads_get_non_admin", ok, f"status={r.status_code} detail={detail}")
    else:
        log("leads_get_non_admin", False, f"status={r.status_code} expected 403 with 'غير مصرح'")
else:
    log("leads_get_non_admin", False, f"Could not create test user: status={r.status_code}")
    non_admin_token = None

# ==================== REGRESSION: EXISTING ENDPOINTS ====================
print("\n[2] Testing REGRESSION - Existing endpoints...")

# Test 6: Login with existing user
print("\n  → POST /api/auth/login...")
login_token = None
for creds in [
    {"email": "sarah@ruaa.co", "password": "testpass123"},
    {"email": "test2@test.com", "password": "testpass123"}
]:
    r = requests.post(f"{BASE}/auth/login", json=creds)
    if r.status_code == 200 and "token" in r.json():
        login_token = r.json()["token"]
        log("auth_login", True, f"logged in as {creds['email']}")
        break

if not login_token:
    # Try creating a new user
    print("    Existing users not found, creating new user...")
    uid = uuid.uuid4().hex[:8]
    new_email = f"regtest_{uid}@test.com"
    r = requests.post(f"{BASE}/auth/signup", json={
        "email": new_email,
        "password": "testpass123",
        "name": "Regression Test",
        "username": f"regtest_{uid}"
    })
    if r.status_code == 200:
        login_token = r.json().get("token")
        log("auth_login", True, f"created and logged in as {new_email}")
    else:
        log("auth_login", False, f"Could not login or create user")

# Test 7: GET /api/auth/me
if login_token:
    print("\n  → GET /api/auth/me...")
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {login_token}"})
    ok = r.status_code == 200 and "username" in r.json()
    log("auth_me", ok, f"status={r.status_code}")
else:
    log("auth_me", False, "No token available")

# Test 8: GET /api/videos/feed
print("\n  → GET /api/videos/feed...")
r = requests.get(f"{BASE}/videos/feed")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("videos_feed", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 9: GET /api/communities
print("\n  → GET /api/communities...")
r = requests.get(f"{BASE}/communities")
if r.status_code == 200:
    communities = r.json()
    ok = isinstance(communities, list) and len(communities) == 10
    log("communities_list", ok, f"status={r.status_code} count={len(communities)}")
else:
    log("communities_list", False, f"status={r.status_code}")

# Test 10: GET /api/teams
print("\n  → GET /api/teams...")
r = requests.get(f"{BASE}/teams")
ok = r.status_code == 200
log("teams_list", ok, f"status={r.status_code}")

# Test 11: GET /api/incubator/stages
print("\n  → GET /api/incubator/stages...")
r = requests.get(f"{BASE}/incubator/stages")
if r.status_code == 200:
    stages = r.json()
    ok = isinstance(stages, list) and len(stages) == 7
    log("incubator_stages", ok, f"status={r.status_code} count={len(stages)}")
else:
    log("incubator_stages", False, f"status={r.status_code}")

# Test 12: GET /api/explore/creators
print("\n  → GET /api/explore/creators...")
r = requests.get(f"{BASE}/explore/creators")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("explore_creators", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 13: POST /api/ai/assist (requires EMERGENT_LLM_KEY)
if login_token:
    print("\n  → POST /api/ai/assist...")
    r = requests.post(f"{BASE}/ai/assist", 
                     json={"task": "project_names", "context": "مقهى"},
                     headers={"Authorization": f"Bearer {login_token}"},
                     timeout=30)
    if r.status_code == 200:
        result = r.json().get("result", "")
        ok = isinstance(result, str) and len(result) > 0
        log("ai_assist", ok, f"status={r.status_code} result_length={len(result)}")
    else:
        log("ai_assist", False, f"status={r.status_code} body={r.text[:200]}")
else:
    log("ai_assist", False, "No token available")

# ==================== SUMMARY ====================
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"✅ Passed: {len(results['passed'])}")
print(f"❌ Failed: {len(results['failed'])}")

if results['failed']:
    print("\nFailed tests:")
    for f in results['failed']:
        print(f"  - {f['test']}: {f['detail']}")

# Save results
with open("/tmp/backend_test_results.json", "w") as fp:
    json.dump(results, fp, indent=2)

print(f"\nResults saved to /tmp/backend_test_results.json")
print("=" * 80)
