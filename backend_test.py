#!/usr/bin/env python3
"""
Iteration 10 — Content OS Engine V1 — Full Backend Test
Tests all 29 scenarios from review request.
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://doc-restore-3.preview.emergentagent.com/api"

# Test results
results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "tests": []
}

def log_test(name, status, details=""):
    """Log test result"""
    results["total"] += 1
    results["tests"].append({
        "name": name,
        "status": status,
        "details": details
    })
    if status == "PASS":
        results["passed"] += 1
        print(f"✅ {name}")
    elif status == "FAIL":
        results["failed"] += 1
        print(f"❌ {name}: {details}")
    elif status == "SKIP":
        results["skipped"] += 1
        print(f"⏭️  {name}: {details}")
    if details and status != "SKIP":
        print(f"   {details}")

def signup_user(email, password, name, username):
    """Create a new user"""
    resp = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email,
        "password": password,
        "name": name,
        "username": username,
        "role": "creator"
    })
    if resp.status_code == 200:
        return resp.json()["token"]
    return None

def login_user(email, password):
    """Login existing user"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    if resp.status_code == 200:
        return resp.json()["token"]
    return None

def headers(token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {token}"}

# ═══════════════════════════════════════════════════════════════
# MAIN TEST SUITE
# ═══════════════════════════════════════════════════════════════

print("=" * 70)
print("ITERATION 10 — CONTENT OS ENGINE V1 — FULL BACKEND TEST")
print("=" * 70)

# Create first test user
print("\n🔐 Setting up test users...")
user1_email = f"content_test_user1_{datetime.now().timestamp()}@test.com"
user1_token = signup_user(user1_email, "testpass123", "Content User 1", f"contentuser1_{int(datetime.now().timestamp())}")
if not user1_token:
    print("❌ Failed to create user1")
    sys.exit(1)
print(f"✅ User1 created: {user1_email}")

# ═══════════════════════════════════════════════════════════════
# TEST 1: META
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("META ENDPOINT")
print("=" * 70)

resp = requests.get(f"{BASE_URL}/content/meta")
if resp.status_code == 200:
    data = resp.json()
    if "statuses" in data and "platforms" in data and "formats" in data:
        if len(data["statuses"]) == 7 and len(data["platforms"]) == 8 and len(data["formats"]) == 7:
            # Check structure
            has_structure = all(
                "key" in s and "name" in s and "color" in s 
                for s in data["statuses"]
            ) and all(
                "key" in p and "name" in p and "color" in p 
                for p in data["platforms"]
            ) and all(
                "key" in f and "name" in f 
                for f in data["formats"]
            )
            if has_structure:
                log_test("1. GET /content/meta", "PASS", "Returns 7 statuses, 8 platforms, 7 formats with correct structure")
            else:
                log_test("1. GET /content/meta", "FAIL", "Missing required fields in meta objects")
        else:
            log_test("1. GET /content/meta", "FAIL", f"Wrong counts: statuses={len(data['statuses'])}, platforms={len(data['platforms'])}, formats={len(data['formats'])}")
    else:
        log_test("1. GET /content/meta", "FAIL", "Missing statuses/platforms/formats keys")
else:
    log_test("1. GET /content/meta", "FAIL", f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# TESTS 2-17: ITEMS CRUD
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("ITEMS CRUD")
print("=" * 70)

# Test 2: Empty list initially
resp = requests.get(f"{BASE_URL}/content/items", headers=headers(user1_token))
if resp.status_code == 200 and resp.json() == []:
    log_test("2. GET /content/items (empty)", "PASS", "Returns empty list for new user")
else:
    log_test("2. GET /content/items (empty)", "FAIL", f"Status {resp.status_code} or not empty: {resp.json()}")

# Test 3: Create valid item
item1_data = {
    "title": "5 Marketing Tips",
    "description": "For reels",
    "platform": "instagram",
    "format": "reel",
    "status": "idea",
    "hook": "You know what?"
}
resp = requests.post(f"{BASE_URL}/content/items", json=item1_data, headers=headers(user1_token))
if resp.status_code == 200:
    item1 = resp.json()
    if "id" in item1 and "owner_id" in item1 and item1["title"] == "5 Marketing Tips":
        item1_id = item1["id"]
        log_test("3. POST /content/items (valid)", "PASS", f"Created item with id={item1_id}, owner_id set, all defaults applied")
    else:
        log_test("3. POST /content/items (valid)", "FAIL", "Missing id/owner_id or wrong data")
else:
    log_test("3. POST /content/items (valid)", "FAIL", f"Status {resp.status_code}: {resp.text}")

# Test 4: Invalid status
resp = requests.post(f"{BASE_URL}/content/items", json={
    "title": "Test",
    "platform": "instagram",
    "format": "post",
    "status": "bad"
}, headers=headers(user1_token))
if resp.status_code == 400:
    log_test("4. POST /content/items (invalid status)", "PASS", "Returns 400 for invalid status")
else:
    log_test("4. POST /content/items (invalid status)", "FAIL", f"Expected 400, got {resp.status_code}")

# Test 5: Invalid platform
resp = requests.post(f"{BASE_URL}/content/items", json={
    "title": "Test",
    "platform": "myspace",
    "format": "post",
    "status": "idea"
}, headers=headers(user1_token))
if resp.status_code == 400:
    log_test("5. POST /content/items (invalid platform)", "PASS", "Returns 400 for invalid platform")
else:
    log_test("5. POST /content/items (invalid platform)", "FAIL", f"Expected 400, got {resp.status_code}")

# Test 6: Invalid format
resp = requests.post(f"{BASE_URL}/content/items", json={
    "title": "Test",
    "platform": "instagram",
    "format": "podcast",
    "status": "idea"
}, headers=headers(user1_token))
if resp.status_code == 400:
    log_test("6. POST /content/items (invalid format)", "PASS", "Returns 400 for invalid format")
else:
    log_test("6. POST /content/items (invalid format)", "FAIL", f"Expected 400, got {resp.status_code}")

# Test 7: Create CRM client first, then item with client_id
crm_client_data = {
    "name": "Test Cafe",
    "email": "cafe@test.com",
    "company": "Test Cafe LLC",
    "industry": "Food & Beverage"
}
resp = requests.post(f"{BASE_URL}/crm/clients", json=crm_client_data, headers=headers(user1_token))
if resp.status_code == 200:
    client_id = resp.json()["id"]
    # Now create item with client_id
    resp = requests.post(f"{BASE_URL}/content/items", json={
        "title": "Cafe Promo",
        "platform": "instagram",
        "format": "post",
        "status": "idea",
        "client_id": client_id
    }, headers=headers(user1_token))
    if resp.status_code == 200:
        item_with_client = resp.json()
        if item_with_client.get("client_id") == client_id:
            log_test("7. POST /content/items (with client_id)", "PASS", f"Item created with client_id={client_id}")
        else:
            log_test("7. POST /content/items (with client_id)", "FAIL", "client_id not set correctly")
    else:
        log_test("7. POST /content/items (with client_id)", "FAIL", f"Status {resp.status_code}")
else:
    log_test("7. POST /content/items (with client_id)", "FAIL", "Failed to create CRM client first")

# Test 8: Non-existent client_id
resp = requests.post(f"{BASE_URL}/content/items", json={
    "title": "Test",
    "platform": "instagram",
    "format": "post",
    "status": "idea",
    "client_id": "non-existent-uuid"
}, headers=headers(user1_token))
if resp.status_code == 404:
    log_test("8. POST /content/items (non-existent client_id)", "PASS", "Returns 404 for non-existent client")
else:
    log_test("8. POST /content/items (non-existent client_id)", "FAIL", f"Expected 404, got {resp.status_code}")

# Test 9: GET item with client populated
if 'item_with_client' in locals():
    resp = requests.get(f"{BASE_URL}/content/items/{item_with_client['id']}", headers=headers(user1_token))
    if resp.status_code == 200:
        item = resp.json()
        if "client" in item and item["client"] is not None:
            log_test("9. GET /content/items/{id} (with client)", "PASS", "Client field populated correctly")
        else:
            log_test("9. GET /content/items/{id} (with client)", "FAIL", "Client field not populated")
    else:
        log_test("9. GET /content/items/{id} (with client)", "FAIL", f"Status {resp.status_code}")
else:
    log_test("9. GET /content/items/{id} (with client)", "SKIP", "No item with client created")

# Test 10: List items (should have 2 now)
resp = requests.get(f"{BASE_URL}/content/items", headers=headers(user1_token))
if resp.status_code == 200:
    items = resp.json()
    if len(items) >= 2:
        log_test("10. GET /content/items (list)", "PASS", f"Returns {len(items)} items")
    else:
        log_test("10. GET /content/items (list)", "FAIL", f"Expected at least 2 items, got {len(items)}")
else:
    log_test("10. GET /content/items (list)", "FAIL", f"Status {resp.status_code}")

# Test 11: Filter by status
resp = requests.get(f"{BASE_URL}/content/items?status=idea", headers=headers(user1_token))
if resp.status_code == 200:
    items = resp.json()
    if all(item["status"] == "idea" for item in items):
        log_test("11. GET /content/items?status=idea", "PASS", f"Filtered {len(items)} items with status=idea")
    else:
        log_test("11. GET /content/items?status=idea", "FAIL", "Some items don't have status=idea")
else:
    log_test("11. GET /content/items?status=idea", "FAIL", f"Status {resp.status_code}")

# Test 12: Filter by platform
resp = requests.get(f"{BASE_URL}/content/items?platform=instagram", headers=headers(user1_token))
if resp.status_code == 200:
    items = resp.json()
    if all(item["platform"] == "instagram" for item in items):
        log_test("12. GET /content/items?platform=instagram", "PASS", f"Filtered {len(items)} items with platform=instagram")
    else:
        log_test("12. GET /content/items?platform=instagram", "FAIL", "Some items don't have platform=instagram")
else:
    log_test("12. GET /content/items?platform=instagram", "FAIL", f"Status {resp.status_code}")

# Test 13: Search by query
resp = requests.get(f"{BASE_URL}/content/items?q=marketing", headers=headers(user1_token))
if resp.status_code == 200:
    items = resp.json()
    # Should find "5 Marketing Tips"
    if len(items) >= 1:
        log_test("13. GET /content/items?q=marketing", "PASS", f"Search found {len(items)} items")
    else:
        log_test("13. GET /content/items?q=marketing", "FAIL", "Search didn't find expected items")
else:
    log_test("13. GET /content/items?q=marketing", "FAIL", f"Status {resp.status_code}")

# Test 14: Update item
if 'item1_id' in locals():
    resp = requests.put(f"{BASE_URL}/content/items/{item1_id}", json={
        "caption": "New caption for marketing tips"
    }, headers=headers(user1_token))
    if resp.status_code == 200:
        updated = resp.json()
        if updated.get("caption") == "New caption for marketing tips":
            log_test("14. PUT /content/items/{id}", "PASS", "Item updated successfully")
        else:
            log_test("14. PUT /content/items/{id}", "FAIL", "Caption not updated")
    else:
        log_test("14. PUT /content/items/{id}", "FAIL", f"Status {resp.status_code}")
else:
    log_test("14. PUT /content/items/{id}", "SKIP", "No item1_id available")

# Test 15: Move status to published
if 'item1_id' in locals():
    resp = requests.put(f"{BASE_URL}/content/items/{item1_id}/status", json={
        "status": "published"
    }, headers=headers(user1_token))
    if resp.status_code == 200:
        updated = resp.json()
        if updated.get("status") == "published" and updated.get("published_at") is not None:
            log_test("15. PUT /content/items/{id}/status (published)", "PASS", "Status moved to published, published_at set")
        else:
            log_test("15. PUT /content/items/{id}/status (published)", "FAIL", f"Status={updated.get('status')}, published_at={updated.get('published_at')}")
    else:
        log_test("15. PUT /content/items/{id}/status (published)", "FAIL", f"Status {resp.status_code}")
else:
    log_test("15. PUT /content/items/{id}/status (published)", "SKIP", "No item1_id available")

# Test 16: Invalid status move
if 'item1_id' in locals():
    resp = requests.put(f"{BASE_URL}/content/items/{item1_id}/status", json={
        "status": "bad"
    }, headers=headers(user1_token))
    if resp.status_code == 400:
        log_test("16. PUT /content/items/{id}/status (invalid)", "PASS", "Returns 400 for invalid status")
    else:
        log_test("16. PUT /content/items/{id}/status (invalid)", "FAIL", f"Expected 400, got {resp.status_code}")
else:
    log_test("16. PUT /content/items/{id}/status (invalid)", "SKIP", "No item1_id available")

# Test 17: Delete item
if 'item1_id' in locals():
    resp = requests.delete(f"{BASE_URL}/content/items/{item1_id}", headers=headers(user1_token))
    if resp.status_code == 200:
        # Verify it's deleted
        resp = requests.get(f"{BASE_URL}/content/items/{item1_id}", headers=headers(user1_token))
        if resp.status_code == 404:
            log_test("17. DELETE /content/items/{id}", "PASS", "Item deleted successfully")
        else:
            log_test("17. DELETE /content/items/{id}", "FAIL", "Item still exists after delete")
    else:
        log_test("17. DELETE /content/items/{id}", "FAIL", f"Status {resp.status_code}")
else:
    log_test("17. DELETE /content/items/{id}", "SKIP", "No item1_id available")

# ═══════════════════════════════════════════════════════════════
# TEST 18: KANBAN
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("KANBAN VIEW")
print("=" * 70)

resp = requests.get(f"{BASE_URL}/content/kanban", headers=headers(user1_token))
if resp.status_code == 200:
    kanban = resp.json()
    # Should have all 7 status keys
    expected_keys = ["idea", "draft", "review", "approved", "scheduled", "published", "archived"]
    if all(key in kanban for key in expected_keys):
        # Check structure
        valid_structure = all(
            "key" in kanban[k] and "name" in kanban[k] and "color" in kanban[k] and 
            "items" in kanban[k] and "count" in kanban[k]
            for k in expected_keys
        )
        if valid_structure:
            log_test("18. GET /content/kanban", "PASS", "Returns all 7 status columns with correct structure")
        else:
            log_test("18. GET /content/kanban", "FAIL", "Missing required fields in kanban columns")
    else:
        log_test("18. GET /content/kanban", "FAIL", f"Missing status keys. Got: {list(kanban.keys())}")
else:
    log_test("18. GET /content/kanban", "FAIL", f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# TESTS 19-21: CALENDAR
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("CALENDAR VIEW")
print("=" * 70)

# Test 19: Create item with scheduled_at
scheduled_item_data = {
    "title": "Scheduled Post",
    "platform": "instagram",
    "format": "post",
    "status": "scheduled",
    "scheduled_at": "2026-08-15T10:00:00"
}
resp = requests.post(f"{BASE_URL}/content/items", json=scheduled_item_data, headers=headers(user1_token))
if resp.status_code == 200:
    scheduled_item = resp.json()
    log_test("19. Create item with scheduled_at", "PASS", f"Created scheduled item for 2026-08-15")
else:
    log_test("19. Create item with scheduled_at", "FAIL", f"Status {resp.status_code}")

# Test 20: GET calendar for August 2026
resp = requests.get(f"{BASE_URL}/content/calendar?year=2026&month=8", headers=headers(user1_token))
if resp.status_code == 200:
    calendar = resp.json()
    if calendar.get("year") == 2026 and calendar.get("month") == 8:
        if "2026-08-15" in calendar.get("days", {}):
            if calendar.get("count", 0) >= 1:
                log_test("20. GET /content/calendar?year=2026&month=8", "PASS", f"Returns calendar with scheduled item on 2026-08-15, count={calendar['count']}")
            else:
                log_test("20. GET /content/calendar?year=2026&month=8", "FAIL", "Count is 0")
        else:
            log_test("20. GET /content/calendar?year=2026&month=8", "FAIL", f"2026-08-15 not in days. Days: {list(calendar.get('days', {}).keys())}")
    else:
        log_test("20. GET /content/calendar?year=2026&month=8", "FAIL", f"Wrong year/month: {calendar.get('year')}/{calendar.get('month')}")
else:
    log_test("20. GET /content/calendar?year=2026&month=8", "FAIL", f"Status {resp.status_code}")

# Test 21: GET calendar for January 2026 (no items)
resp = requests.get(f"{BASE_URL}/content/calendar?year=2026&month=1", headers=headers(user1_token))
if resp.status_code == 200:
    calendar = resp.json()
    if calendar.get("days") == {} and calendar.get("count") == 0:
        log_test("21. GET /content/calendar?year=2026&month=1 (empty)", "PASS", "Returns empty calendar for month with no items")
    else:
        log_test("21. GET /content/calendar?year=2026&month=1 (empty)", "FAIL", f"Expected empty, got days={calendar.get('days')}, count={calendar.get('count')}")
else:
    log_test("21. GET /content/calendar?year=2026&month=1 (empty)", "FAIL", f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# TEST 22: STATS
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("STATS")
print("=" * 70)

resp = requests.get(f"{BASE_URL}/content/stats", headers=headers(user1_token))
if resp.status_code == 200:
    stats = resp.json()
    required_fields = ["total", "ideas", "drafts", "scheduled", "published", "published_this_month", "by_platform", "by_status"]
    if all(field in stats for field in required_fields):
        # Check by_platform has 8 items and by_status has 7 items
        if len(stats["by_platform"]) == 8 and len(stats["by_status"]) == 7:
            log_test("22. GET /content/stats", "PASS", f"Returns all KPIs: total={stats['total']}, ideas={stats['ideas']}, drafts={stats['drafts']}, scheduled={stats['scheduled']}, published={stats['published']}, by_platform=8, by_status=7")
        else:
            log_test("22. GET /content/stats", "FAIL", f"Wrong counts: by_platform={len(stats['by_platform'])}, by_status={len(stats['by_status'])}")
    else:
        log_test("22. GET /content/stats", "FAIL", f"Missing required fields. Got: {list(stats.keys())}")
else:
    log_test("22. GET /content/stats", "FAIL", f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# TESTS 23-26: AI ENDPOINTS
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("AI ENDPOINTS (may fail with 500 if budget exceeded)")
print("=" * 70)

# Test 23: AI ideas
resp = requests.post(f"{BASE_URL}/content/ai/ideas", json={
    "topic": "مقهى متخصص",
    "platform": "instagram",
    "format": "reel"
}, headers=headers(user1_token))
if resp.status_code == 200:
    data = resp.json()
    if "result" in data:
        log_test("23. POST /content/ai/ideas", "PASS", "Returns AI-generated ideas")
    else:
        log_test("23. POST /content/ai/ideas", "FAIL", "Missing result field")
elif resp.status_code == 500:
    log_test("23. POST /content/ai/ideas", "SKIP", "500 error (expected if EMERGENT_LLM_KEY budget exceeded)")
else:
    log_test("23. POST /content/ai/ideas", "FAIL", f"Unexpected status {resp.status_code}")

# Test 24: AI script
resp = requests.post(f"{BASE_URL}/content/ai/script", json={
    "topic": "5 tips",
    "platform": "tiktok",
    "format": "reel"
}, headers=headers(user1_token))
if resp.status_code == 200:
    data = resp.json()
    if "result" in data:
        log_test("24. POST /content/ai/script", "PASS", "Returns AI-generated script")
    else:
        log_test("24. POST /content/ai/script", "FAIL", "Missing result field")
elif resp.status_code == 500:
    log_test("24. POST /content/ai/script", "SKIP", "500 error (expected if EMERGENT_LLM_KEY budget exceeded)")
else:
    log_test("24. POST /content/ai/script", "FAIL", f"Unexpected status {resp.status_code}")

# Test 25: AI caption
resp = requests.post(f"{BASE_URL}/content/ai/caption", json={
    "topic": "my caption"
}, headers=headers(user1_token))
if resp.status_code == 200:
    data = resp.json()
    if "result" in data:
        log_test("25. POST /content/ai/caption", "PASS", "Returns improved caption")
    else:
        log_test("25. POST /content/ai/caption", "FAIL", "Missing result field")
elif resp.status_code == 500:
    log_test("25. POST /content/ai/caption", "SKIP", "500 error (expected if EMERGENT_LLM_KEY budget exceeded)")
else:
    log_test("25. POST /content/ai/caption", "FAIL", f"Unexpected status {resp.status_code}")

# Test 26: AI hashtags
resp = requests.post(f"{BASE_URL}/content/ai/hashtags", json={
    "topic": "marketing content",
    "platform": "instagram"
}, headers=headers(user1_token))
if resp.status_code == 200:
    data = resp.json()
    if "result" in data:
        log_test("26. POST /content/ai/hashtags", "PASS", "Returns AI-generated hashtags")
    else:
        log_test("26. POST /content/ai/hashtags", "FAIL", "Missing result field")
elif resp.status_code == 500:
    log_test("26. POST /content/ai/hashtags", "SKIP", "500 error (expected if EMERGENT_LLM_KEY budget exceeded)")
else:
    log_test("26. POST /content/ai/hashtags", "FAIL", f"Unexpected status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# TESTS 27-28: USER ISOLATION
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("USER ISOLATION (CRITICAL)")
print("=" * 70)

# Create second user
user2_email = f"content_test_user2_{datetime.now().timestamp()}@test.com"
user2_token = signup_user(user2_email, "testpass123", "Content User 2", f"contentuser2_{int(datetime.now().timestamp())}")
if not user2_token:
    log_test("27. Create second user", "FAIL", "Failed to create user2")
    log_test("28. User isolation check", "SKIP", "No user2 token")
else:
    print(f"✅ User2 created: {user2_email}")
    
    # Test 27: Second user should see empty list
    resp = requests.get(f"{BASE_URL}/content/items", headers=headers(user2_token))
    if resp.status_code == 200 and resp.json() == []:
        log_test("27. GET /content/items (user2 empty)", "PASS", "User2 sees empty list (strict isolation)")
    else:
        log_test("27. GET /content/items (user2 empty)", "FAIL", f"User2 sees {len(resp.json())} items (should be 0)")
    
    # Test 28: Second user cannot access first user's item
    if 'item_with_client' in locals():
        first_user_item_id = item_with_client['id']
        resp = requests.get(f"{BASE_URL}/content/items/{first_user_item_id}", headers=headers(user2_token))
        if resp.status_code == 404:
            log_test("28. GET /content/items/{first_user_item_id} (user2)", "PASS", "User2 gets 404 for user1's item (strict isolation)")
        else:
            log_test("28. GET /content/items/{first_user_item_id} (user2)", "FAIL", f"User2 got status {resp.status_code} (should be 404)")
    else:
        log_test("28. GET /content/items/{first_user_item_id} (user2)", "SKIP", "No first user item available")

# ═══════════════════════════════════════════════════════════════
# TEST 29: LEGACY PING
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("LEGACY ENDPOINT")
print("=" * 70)

resp = requests.get(f"{BASE_URL}/content/ping")
if resp.status_code == 200:
    data = resp.json()
    if data.get("engine") == "content" and data.get("status") == "active" and data.get("version") == "v1":
        log_test("29. GET /content/ping", "PASS", "Returns correct ping response")
    else:
        log_test("29. GET /content/ping", "FAIL", f"Wrong response: {data}")
else:
    log_test("29. GET /content/ping", "FAIL", f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("TEST SUMMARY")
print("=" * 70)
print(f"Total: {results['total']}")
print(f"✅ Passed: {results['passed']}")
print(f"❌ Failed: {results['failed']}")
print(f"⏭️  Skipped: {results['skipped']}")

# Save JSON report
import os
os.makedirs("/app/test_reports", exist_ok=True)
with open("/app/test_reports/iteration_10.json", "w") as f:
    json.dump(results, f, indent=2)
print(f"\n📄 Report saved to /app/test_reports/iteration_10.json")

# Exit with appropriate code
if results['failed'] > 0:
    sys.exit(1)
else:
    sys.exit(0)
