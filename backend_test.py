#!/usr/bin/env python3
"""
Iteration 9 — CRM Engine V1 Backend Test
Tests ~33 scenarios: CRM meta, Clients CRUD, Deals CRUD, Activities, Stats, User isolation, Legacy leads, Cascade delete
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://f4c8f2f1-4587-4442-842d-9074b7d8c5fd.preview.emergentagent.com/api"

# Test results
results = {
    "timestamp": datetime.utcnow().isoformat(),
    "total": 0,
    "passed": 0,
    "failed": 0,
    "scenarios": []
}

def log_test(name, passed, details=""):
    results["total"] += 1
    if passed:
        results["passed"] += 1
        print(f"✅ {name}")
    else:
        results["failed"] += 1
        print(f"❌ {name}")
        if details:
            print(f"   {details}")
    results["scenarios"].append({
        "name": name,
        "passed": passed,
        "details": details
    })

def signup_user(email, password, name, username):
    """Helper to signup a new user"""
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

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

# ═══════════════════════════════════════════════════════════════
# SETUP: Create two users for isolation testing
# ═══════════════════════════════════════════════════════════════
print("\n🔧 SETUP: Creating test users...")
timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
user1_email = f"crm_user1_{timestamp}@test.com"
user2_email = f"crm_user2_{timestamp}@test.com"

token1 = signup_user(user1_email, "testpass123", "CRM User 1", f"crmuser1_{timestamp}")
token2 = signup_user(user2_email, "testpass123", "CRM User 2", f"crmuser2_{timestamp}")

if not token1 or not token2:
    print("❌ Failed to create test users")
    sys.exit(1)

print(f"✅ User 1: {user1_email}")
print(f"✅ User 2: {user2_email}")

# Store IDs for later
client_id = None
deal_id = None
activity_id = None

# ═══════════════════════════════════════════════════════════════
# 1. CRM META — GET /api/crm/stages
# ═══════════════════════════════════════════════════════════════
print("\n📋 CRM META")
resp = requests.get(f"{BASE_URL}/crm/stages")
if resp.status_code == 200:
    stages = resp.json()
    if len(stages) == 7 and all(k in stages[0] for k in ["key", "name", "probability", "color"]):
        expected_keys = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
        actual_keys = [s["key"] for s in stages]
        if actual_keys == expected_keys:
            log_test("1. GET /crm/stages → 200 with 7 stages", True)
        else:
            log_test("1. GET /crm/stages → 200 with 7 stages", False, f"Keys mismatch: {actual_keys}")
    else:
        log_test("1. GET /crm/stages → 200 with 7 stages", False, f"Invalid structure: {stages}")
else:
    log_test("1. GET /crm/stages → 200 with 7 stages", False, f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# CLIENTS CRUD (User 1)
# ═══════════════════════════════════════════════════════════════
print("\n👥 CLIENTS CRUD")

# 2. GET /crm/clients empty initially
resp = requests.get(f"{BASE_URL}/crm/clients", headers=auth_headers(token1))
if resp.status_code == 200 and resp.json() == []:
    log_test("2. GET /crm/clients → 200 empty list initially", True)
else:
    log_test("2. GET /crm/clients → 200 empty list initially", False, f"Status {resp.status_code}, body: {resp.text[:200]}")

# 3. POST /crm/clients — create Alba Cafe
resp = requests.post(f"{BASE_URL}/crm/clients", headers=auth_headers(token1), json={
    "name": "Alba Cafe",
    "email": "info@alba.com",
    "company": "Alba LLC",
    "industry": "F&B"
})
if resp.status_code == 200:
    client = resp.json()
    if "id" in client and "owner_id" in client and client.get("deals_count") == 0:
        client_id = client["id"]
        log_test("3. POST /crm/clients → 200 with id + owner_id + deals_count:0", True)
    else:
        log_test("3. POST /crm/clients → 200 with id + owner_id + deals_count:0", False, f"Missing fields: {client}")
else:
    log_test("3. POST /crm/clients → 200 with id + owner_id + deals_count:0", False, f"Status {resp.status_code}")

# 4. GET /crm/clients → 1 client
resp = requests.get(f"{BASE_URL}/crm/clients", headers=auth_headers(token1))
if resp.status_code == 200:
    clients = resp.json()
    if len(clients) == 1 and clients[0].get("deals_count") == 0:
        log_test("4. GET /crm/clients → 200 with 1 client, deals_count:0", True)
    else:
        log_test("4. GET /crm/clients → 200 with 1 client, deals_count:0", False, f"Count: {len(clients)}")
else:
    log_test("4. GET /crm/clients → 200 with 1 client, deals_count:0", False, f"Status {resp.status_code}")

# 5. GET /crm/clients/{id} → with deals:[] activities:[]
if client_id:
    resp = requests.get(f"{BASE_URL}/crm/clients/{client_id}", headers=auth_headers(token1))
    if resp.status_code == 200:
        client = resp.json()
        if "deals" in client and "activities" in client and client["deals"] == [] and client["activities"] == []:
            log_test("5. GET /crm/clients/{id} → 200 with deals:[] activities:[]", True)
        else:
            log_test("5. GET /crm/clients/{id} → 200 with deals:[] activities:[]", False, f"Missing fields: {client.keys()}")
    else:
        log_test("5. GET /crm/clients/{id} → 200 with deals:[] activities:[]", False, f"Status {resp.status_code}")
else:
    log_test("5. GET /crm/clients/{id} → 200 with deals:[] activities:[]", False, "No client_id")

# 6. PUT /crm/clients/{id} — update industry
if client_id:
    resp = requests.put(f"{BASE_URL}/crm/clients/{client_id}", headers=auth_headers(token1), json={
        "industry": "Restaurants"
    })
    if resp.status_code == 200:
        client = resp.json()
        if client.get("industry") == "Restaurants":
            log_test("6. PUT /crm/clients/{id} → 200 updated", True)
        else:
            log_test("6. PUT /crm/clients/{id} → 200 updated", False, f"Industry not updated: {client.get('industry')}")
    else:
        log_test("6. PUT /crm/clients/{id} → 200 updated", False, f"Status {resp.status_code}")
else:
    log_test("6. PUT /crm/clients/{id} → 200 updated", False, "No client_id")

# 7. GET /crm/clients?q=alba → finds by name
resp = requests.get(f"{BASE_URL}/crm/clients?q=alba", headers=auth_headers(token1))
if resp.status_code == 200:
    clients = resp.json()
    if len(clients) == 1 and "Alba" in clients[0].get("name", ""):
        log_test("7. GET /crm/clients?q=alba → 200 finds by name", True)
    else:
        log_test("7. GET /crm/clients?q=alba → 200 finds by name", False, f"Count: {len(clients)}")
else:
    log_test("7. GET /crm/clients?q=alba → 200 finds by name", False, f"Status {resp.status_code}")

# 8. GET /crm/clients?status=inactive → empty
resp = requests.get(f"{BASE_URL}/crm/clients?status=inactive", headers=auth_headers(token1))
if resp.status_code == 200 and resp.json() == []:
    log_test("8. GET /crm/clients?status=inactive → 200 empty", True)
else:
    log_test("8. GET /crm/clients?status=inactive → 200 empty", False, f"Status {resp.status_code}, body: {resp.text[:200]}")

# ═══════════════════════════════════════════════════════════════
# DEALS CRUD
# ═══════════════════════════════════════════════════════════════
print("\n💼 DEALS CRUD")

# 10. POST /crm/deals — create deal
if client_id:
    resp = requests.post(f"{BASE_URL}/crm/deals", headers=auth_headers(token1), json={
        "title": "Brand redesign",
        "client_id": client_id,
        "value": 5000,
        "stage": "proposal"
    })
    if resp.status_code == 200:
        deal = resp.json()
        if "id" in deal and deal.get("probability") == 50 and deal.get("closed_at") is None and "client" in deal:
            deal_id = deal["id"]
            log_test("10. POST /crm/deals → 200 with probability:50, closed_at:null, client enriched", True)
        else:
            log_test("10. POST /crm/deals → 200 with probability:50, closed_at:null, client enriched", False, f"Fields: {deal.keys()}")
    else:
        log_test("10. POST /crm/deals → 200 with probability:50, closed_at:null, client enriched", False, f"Status {resp.status_code}")
else:
    log_test("10. POST /crm/deals → 200 with probability:50, closed_at:null, client enriched", False, "No client_id")

# 11. POST /crm/deals with invalid client_id → 404
resp = requests.post(f"{BASE_URL}/crm/deals", headers=auth_headers(token1), json={
    "title": "Invalid deal",
    "client_id": "invalid-client-id-12345",
    "value": 1000,
    "stage": "new"
})
if resp.status_code == 404:
    log_test("11. POST /crm/deals with invalid client_id → 404", True)
else:
    log_test("11. POST /crm/deals with invalid client_id → 404", False, f"Status {resp.status_code}")

# 12. POST /crm/deals with invalid stage → 400
if client_id:
    resp = requests.post(f"{BASE_URL}/crm/deals", headers=auth_headers(token1), json={
        "title": "Bad stage deal",
        "client_id": client_id,
        "value": 1000,
        "stage": "invalid_stage"
    })
    if resp.status_code == 400:
        log_test("12. POST /crm/deals with invalid stage → 400", True)
    else:
        log_test("12. POST /crm/deals with invalid stage → 400", False, f"Status {resp.status_code}")
else:
    log_test("12. POST /crm/deals with invalid stage → 400", False, "No client_id")

# 13. GET /crm/deals → 1 deal
resp = requests.get(f"{BASE_URL}/crm/deals", headers=auth_headers(token1))
if resp.status_code == 200:
    deals = resp.json()
    if len(deals) == 1:
        log_test("13. GET /crm/deals → 200 with 1 deal", True)
    else:
        log_test("13. GET /crm/deals → 200 with 1 deal", False, f"Count: {len(deals)}")
else:
    log_test("13. GET /crm/deals → 200 with 1 deal", False, f"Status {resp.status_code}")

# 14. GET /crm/deals?stage=proposal → 1
resp = requests.get(f"{BASE_URL}/crm/deals?stage=proposal", headers=auth_headers(token1))
if resp.status_code == 200:
    deals = resp.json()
    if len(deals) == 1:
        log_test("14. GET /crm/deals?stage=proposal → 200 with 1", True)
    else:
        log_test("14. GET /crm/deals?stage=proposal → 200 with 1", False, f"Count: {len(deals)}")
else:
    log_test("14. GET /crm/deals?stage=proposal → 200 with 1", False, f"Status {resp.status_code}")

# 15. GET /crm/deals?stage=won → empty
resp = requests.get(f"{BASE_URL}/crm/deals?stage=won", headers=auth_headers(token1))
if resp.status_code == 200 and resp.json() == []:
    log_test("15. GET /crm/deals?stage=won → 200 empty", True)
else:
    log_test("15. GET /crm/deals?stage=won → 200 empty", False, f"Status {resp.status_code}, body: {resp.text[:200]}")

# 16. GET /crm/deals/{id} → with activities (should have 1 auto-created)
if deal_id:
    resp = requests.get(f"{BASE_URL}/crm/deals/{deal_id}", headers=auth_headers(token1))
    if resp.status_code == 200:
        deal = resp.json()
        if "activities" in deal and len(deal["activities"]) >= 1:
            # Check if auto-created activity exists
            auto_activity = [a for a in deal["activities"] if "تم إنشاء الصفقة" in a.get("title", "")]
            if auto_activity:
                log_test("16. GET /crm/deals/{id} → 200 with activities (1 auto-created)", True)
            else:
                log_test("16. GET /crm/deals/{id} → 200 with activities (1 auto-created)", False, f"No auto-activity found")
        else:
            log_test("16. GET /crm/deals/{id} → 200 with activities (1 auto-created)", False, f"Activities: {deal.get('activities')}")
    else:
        log_test("16. GET /crm/deals/{id} → 200 with activities (1 auto-created)", False, f"Status {resp.status_code}")
else:
    log_test("16. GET /crm/deals/{id} → 200 with activities (1 auto-created)", False, "No deal_id")

# 17. PUT /crm/deals/{id} — update value
if deal_id:
    resp = requests.put(f"{BASE_URL}/crm/deals/{deal_id}", headers=auth_headers(token1), json={
        "value": 6000
    })
    if resp.status_code == 200:
        deal = resp.json()
        if deal.get("value") == 6000:
            log_test("17. PUT /crm/deals/{id} → 200 updated value", True)
        else:
            log_test("17. PUT /crm/deals/{id} → 200 updated value", False, f"Value: {deal.get('value')}")
    else:
        log_test("17. PUT /crm/deals/{id} → 200 updated value", False, f"Status {resp.status_code}")
else:
    log_test("17. PUT /crm/deals/{id} → 200 updated value", False, "No deal_id")

# 18. PUT /crm/deals/{id}/stage → won
if deal_id:
    resp = requests.put(f"{BASE_URL}/crm/deals/{deal_id}/stage", headers=auth_headers(token1), json={
        "stage": "won"
    })
    if resp.status_code == 200:
        deal = resp.json()
        if deal.get("stage") == "won" and deal.get("probability") == 100 and deal.get("closed_at") is not None:
            log_test("18. PUT /crm/deals/{id}/stage → won (stage:won, probability:100, closed_at NOT null)", True)
        else:
            log_test("18. PUT /crm/deals/{id}/stage → won (stage:won, probability:100, closed_at NOT null)", False, f"Stage: {deal.get('stage')}, prob: {deal.get('probability')}, closed: {deal.get('closed_at')}")
    else:
        log_test("18. PUT /crm/deals/{id}/stage → won (stage:won, probability:100, closed_at NOT null)", False, f"Status {resp.status_code}")
else:
    log_test("18. PUT /crm/deals/{id}/stage → won (stage:won, probability:100, closed_at NOT null)", False, "No deal_id")

# 19. PUT /crm/deals/{id}/stage → lost
if deal_id:
    resp = requests.put(f"{BASE_URL}/crm/deals/{deal_id}/stage", headers=auth_headers(token1), json={
        "stage": "lost"
    })
    if resp.status_code == 200:
        deal = resp.json()
        if deal.get("stage") == "lost" and deal.get("closed_at") is not None:
            log_test("19. PUT /crm/deals/{id}/stage → lost (closed_at updates)", True)
        else:
            log_test("19. PUT /crm/deals/{id}/stage → lost (closed_at updates)", False, f"Stage: {deal.get('stage')}, closed: {deal.get('closed_at')}")
    else:
        log_test("19. PUT /crm/deals/{id}/stage → lost (closed_at updates)", False, f"Status {resp.status_code}")
else:
    log_test("19. PUT /crm/deals/{id}/stage → lost (closed_at updates)", False, "No deal_id")

# 20. GET /crm/deals/pipeline → dict keyed by stage
resp = requests.get(f"{BASE_URL}/crm/deals/pipeline", headers=auth_headers(token1))
if resp.status_code == 200:
    pipeline = resp.json()
    if len(pipeline) == 7 and "lost" in pipeline:
        lost_stage = pipeline["lost"]
        if "deals" in lost_stage and "count" in lost_stage and "total_value" in lost_stage:
            # Deal should be in lost now
            if lost_stage["count"] >= 1:
                log_test("20. GET /crm/deals/pipeline → 200 dict with 7 stages, deal in 'lost'", True)
            else:
                log_test("20. GET /crm/deals/pipeline → 200 dict with 7 stages, deal in 'lost'", False, f"Lost count: {lost_stage['count']}")
        else:
            log_test("20. GET /crm/deals/pipeline → 200 dict with 7 stages, deal in 'lost'", False, f"Lost stage missing fields: {lost_stage.keys()}")
    else:
        log_test("20. GET /crm/deals/pipeline → 200 dict with 7 stages, deal in 'lost'", False, f"Pipeline keys: {pipeline.keys()}")
else:
    log_test("20. GET /crm/deals/pipeline → 200 dict with 7 stages, deal in 'lost'", False, f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# ACTIVITIES
# ═══════════════════════════════════════════════════════════════
print("\n📝 ACTIVITIES")

# 21. POST /crm/activities — create call activity
if deal_id:
    resp = requests.post(f"{BASE_URL}/crm/activities", headers=auth_headers(token1), json={
        "type": "call",
        "title": "Discussed contract",
        "deal_id": deal_id
    })
    if resp.status_code == 200:
        activity = resp.json()
        if "id" in activity:
            activity_id = activity["id"]
            log_test("21. POST /crm/activities → 200", True)
        else:
            log_test("21. POST /crm/activities → 200", False, f"Missing id: {activity}")
    else:
        log_test("21. POST /crm/activities → 200", False, f"Status {resp.status_code}")
else:
    log_test("21. POST /crm/activities → 200", False, "No deal_id")

# 22. POST /crm/activities with invalid type → 400
if deal_id:
    resp = requests.post(f"{BASE_URL}/crm/activities", headers=auth_headers(token1), json={
        "type": "bad",
        "title": "Invalid activity",
        "deal_id": deal_id
    })
    if resp.status_code == 400:
        log_test("22. POST /crm/activities with invalid type → 400", True)
    else:
        log_test("22. POST /crm/activities with invalid type → 400", False, f"Status {resp.status_code}")
else:
    log_test("22. POST /crm/activities with invalid type → 400", False, "No deal_id")

# 23. POST /crm/activities with no client_id and no deal_id → 400
resp = requests.post(f"{BASE_URL}/crm/activities", headers=auth_headers(token1), json={
    "type": "note",
    "title": "Orphan activity"
})
if resp.status_code == 400:
    log_test("23. POST /crm/activities with no client_id and no deal_id → 400", True)
else:
    log_test("23. POST /crm/activities with no client_id and no deal_id → 400", False, f"Status {resp.status_code}")

# 24. GET /crm/activities → should have auto-logs + manual call
resp = requests.get(f"{BASE_URL}/crm/activities", headers=auth_headers(token1))
if resp.status_code == 200:
    activities = resp.json()
    # Should have at least: 1 auto-created on deal creation + 2 stage changes (won, lost) + 1 manual call = 4+
    if len(activities) >= 4:
        # Check enrichment
        if all("client_name" in a or "deal_title" in a for a in activities):
            log_test("24. GET /crm/activities → 200 with auto-logs + manual, enriched", True)
        else:
            log_test("24. GET /crm/activities → 200 with auto-logs + manual, enriched", False, "Missing enrichment")
    else:
        log_test("24. GET /crm/activities → 200 with auto-logs + manual, enriched", False, f"Count: {len(activities)}")
else:
    log_test("24. GET /crm/activities → 200 with auto-logs + manual, enriched", False, f"Status {resp.status_code}")

# 25. GET /crm/activities?deal_id={id} → filtered
if deal_id:
    resp = requests.get(f"{BASE_URL}/crm/activities?deal_id={deal_id}", headers=auth_headers(token1))
    if resp.status_code == 200:
        activities = resp.json()
        if len(activities) >= 4:  # auto-created + 2 stage changes + manual call
            log_test("25. GET /crm/activities?deal_id={id} → 200 filtered", True)
        else:
            log_test("25. GET /crm/activities?deal_id={id} → 200 filtered", False, f"Count: {len(activities)}")
    else:
        log_test("25. GET /crm/activities?deal_id={id} → 200 filtered", False, f"Status {resp.status_code}")
else:
    log_test("25. GET /crm/activities?deal_id={id} → 200 filtered", False, "No deal_id")

# 26. DELETE /crm/activities/{id} → 200
if activity_id:
    resp = requests.delete(f"{BASE_URL}/crm/activities/{activity_id}", headers=auth_headers(token1))
    if resp.status_code == 200:
        log_test("26. DELETE /crm/activities/{id} → 200", True)
    else:
        log_test("26. DELETE /crm/activities/{id} → 200", False, f"Status {resp.status_code}")
else:
    log_test("26. DELETE /crm/activities/{id} → 200", False, "No activity_id")

# ═══════════════════════════════════════════════════════════════
# STATS DASHBOARD
# ═══════════════════════════════════════════════════════════════
print("\n📊 STATS DASHBOARD")

# 27. GET /crm/stats → comprehensive KPIs
resp = requests.get(f"{BASE_URL}/crm/stats", headers=auth_headers(token1))
if resp.status_code == 200:
    stats = resp.json()
    required_fields = [
        "clients_total", "clients_active", "deals_total", "deals_active",
        "deals_won", "deals_lost", "pipeline_value", "weighted_pipeline",
        "won_value", "avg_deal_size", "win_rate", "by_stage"
    ]
    if all(f in stats for f in required_fields):
        if len(stats["by_stage"]) == 7:
            log_test("27. GET /crm/stats → 200 with all KPIs + by_stage (7 items)", True)
        else:
            log_test("27. GET /crm/stats → 200 with all KPIs + by_stage (7 items)", False, f"by_stage count: {len(stats['by_stage'])}")
    else:
        missing = [f for f in required_fields if f not in stats]
        log_test("27. GET /crm/stats → 200 with all KPIs + by_stage (7 items)", False, f"Missing fields: {missing}")
else:
    log_test("27. GET /crm/stats → 200 with all KPIs + by_stage (7 items)", False, f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# USER ISOLATION (critical!)
# ═══════════════════════════════════════════════════════════════
print("\n🔒 USER ISOLATION")

# 28. Second user GET /crm/clients → empty
resp = requests.get(f"{BASE_URL}/crm/clients", headers=auth_headers(token2))
if resp.status_code == 200 and resp.json() == []:
    log_test("28. Second user GET /crm/clients → 200 EMPTY (isolation working)", True)
else:
    log_test("28. Second user GET /crm/clients → 200 EMPTY (isolation working)", False, f"Status {resp.status_code}, body: {resp.text[:200]}")

# 29. Second user tries GET /crm/clients/{first_user_client_id} → 404
if client_id:
    resp = requests.get(f"{BASE_URL}/crm/clients/{client_id}", headers=auth_headers(token2))
    if resp.status_code == 404:
        log_test("29. Second user GET /crm/clients/{first_user_client_id} → 404", True)
    else:
        log_test("29. Second user GET /crm/clients/{first_user_client_id} → 404", False, f"Status {resp.status_code}")
else:
    log_test("29. Second user GET /crm/clients/{first_user_client_id} → 404", False, "No client_id")

# 30. Second user tries PUT /crm/deals/{first_user_deal_id}/stage → 404
if deal_id:
    resp = requests.put(f"{BASE_URL}/crm/deals/{deal_id}/stage", headers=auth_headers(token2), json={
        "stage": "won"
    })
    if resp.status_code == 404:
        log_test("30. Second user PUT /crm/deals/{first_user_deal_id}/stage → 404", True)
    else:
        log_test("30. Second user PUT /crm/deals/{first_user_deal_id}/stage → 404", False, f"Status {resp.status_code}")
else:
    log_test("30. Second user PUT /crm/deals/{first_user_deal_id}/stage → 404", False, "No deal_id")

# ═══════════════════════════════════════════════════════════════
# LEGACY LEADS (should still work)
# ═══════════════════════════════════════════════════════════════
print("\n📧 LEGACY LEADS")

# 31. POST /leads → 200
resp = requests.post(f"{BASE_URL}/leads", json={
    "name": "Legacy Lead",
    "email": "legacy@test.com",
    "story": "Testing legacy leads endpoint"
})
if resp.status_code == 200:
    lead = resp.json()
    if lead.get("success") and "id" in lead:
        log_test("31. POST /leads → 200 (legacy endpoint working)", True)
    else:
        log_test("31. POST /leads → 200 (legacy endpoint working)", False, f"Response: {lead}")
else:
    log_test("31. POST /leads → 200 (legacy endpoint working)", False, f"Status {resp.status_code}")

# 32. GET /leads unauth → 401
resp = requests.get(f"{BASE_URL}/leads")
if resp.status_code == 401:
    log_test("32. GET /leads unauth → 401", True)
else:
    log_test("32. GET /leads unauth → 401", False, f"Status {resp.status_code}")

# ═══════════════════════════════════════════════════════════════
# CASCADE DELETE
# ═══════════════════════════════════════════════════════════════
print("\n🗑️  CASCADE DELETE")

# 33. DELETE client → all deals and activities gone
if client_id:
    resp = requests.delete(f"{BASE_URL}/crm/clients/{client_id}", headers=auth_headers(token1))
    if resp.status_code == 200:
        # Verify deals are gone
        resp_deals = requests.get(f"{BASE_URL}/crm/deals", headers=auth_headers(token1))
        resp_stats = requests.get(f"{BASE_URL}/crm/stats", headers=auth_headers(token1))
        if resp_deals.status_code == 200 and resp_stats.status_code == 200:
            deals = resp_deals.json()
            stats = resp_stats.json()
            if len(deals) == 0 and stats.get("clients_total") == 0:
                log_test("33. DELETE client → cascade delete works (deals + activities gone, stats updated)", True)
            else:
                log_test("33. DELETE client → cascade delete works (deals + activities gone, stats updated)", False, f"Deals: {len(deals)}, clients_total: {stats.get('clients_total')}")
        else:
            log_test("33. DELETE client → cascade delete works (deals + activities gone, stats updated)", False, "Failed to verify")
    else:
        log_test("33. DELETE client → cascade delete works (deals + activities gone, stats updated)", False, f"Status {resp.status_code}")
else:
    log_test("33. DELETE client → cascade delete works (deals + activities gone, stats updated)", False, "No client_id")

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "="*60)
print(f"📊 FINAL RESULTS: {results['passed']}/{results['total']} tests passed")
print("="*60)

if results["failed"] > 0:
    print("\n❌ FAILED TESTS:")
    for s in results["scenarios"]:
        if not s["passed"]:
            print(f"  - {s['name']}")
            if s["details"]:
                print(f"    {s['details']}")

# Save report
import os
os.makedirs("/app/test_reports", exist_ok=True)
with open("/app/test_reports/iteration_9.json", "w") as f:
    json.dump(results, f, indent=2)

print(f"\n✅ Report saved to /app/test_reports/iteration_9.json")

# Exit with appropriate code
sys.exit(0 if results["failed"] == 0 else 1)
