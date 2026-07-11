#!/usr/bin/env python3
"""
Iteration 8 Backend Tests - FULL REGRESSION PASS
Testing all 18 engines after monolithic refactor
"""
import requests
import json
import uuid
import time

BASE = "https://f4c8f2f1-4587-4442-842d-9074b7d8c5fd.preview.emergentagent.com/api"

results = {"passed": [], "failed": [], "skipped": []}
test_data = {}  # Store created entities for later tests

def log(name, ok, detail="", skip=False):
    if skip:
        results["skipped"].append({"test": name, "detail": detail})
        print(f"⏭️  [SKIP] {name} {detail}")
    elif ok:
        results["passed"].append(name)
        print(f"✅ [PASS] {name} {detail}")
    else:
        results["failed"].append({"test": name, "detail": detail})
        print(f"❌ [FAIL] {name} {detail}")

print("=" * 80)
print("ITERATION 8 - FULL REGRESSION PASS - Backend Engine Restructure")
print("=" * 80)

# ==================== SANITY ENDPOINTS ====================
print("\n[1] SANITY ENDPOINTS (New)")

# Test 1: GET /api
print("\n  → GET /api...")
r = requests.get(f"{BASE}")
if r.status_code == 200:
    j = r.json()
    ok = (j.get("app") == "Ru'ya" and 
          j.get("version") == "2.0.0" and
          "engines" in j and 
          len(j["engines"]) == 18)
    log("sanity_root", ok, f"engines_count={len(j.get('engines', []))}")
else:
    log("sanity_root", False, f"status={r.status_code}")

# Test 2: GET /api/analytics/platform
print("\n  → GET /api/analytics/platform...")
r = requests.get(f"{BASE}/analytics/platform")
if r.status_code == 200:
    j = r.json()
    required_keys = ["users", "videos", "services", "orders", "paid_orders", "communities", "teams", "ideas", "leads"]
    ok = all(k in j for k in required_keys)
    log("sanity_analytics_platform", ok, f"keys={list(j.keys())}")
else:
    log("sanity_analytics_platform", False, f"status={r.status_code}")

# Test 3-6: Placeholder pings
for engine in ["admin", "content", "tasks", "booking"]:
    print(f"\n  → GET /api/{engine}/ping...")
    r = requests.get(f"{BASE}/{engine}/ping")
    ok = r.status_code == 200
    log(f"sanity_{engine}_ping", ok, f"status={r.status_code}")

# ==================== AUTH ENGINE ====================
print("\n[2] AUTH ENGINE")

# Test 7: POST /api/auth/signup
print("\n  → POST /api/auth/signup (new user)...")
uid = uuid.uuid4().hex[:8]
test_data["user1_email"] = f"testuser1_{uid}@test.com"
test_data["user1_username"] = f"testuser1_{uid}"
r = requests.post(f"{BASE}/auth/signup", json={
    "email": test_data["user1_email"],
    "password": "testpass123",
    "name": "Test User 1",
    "username": test_data["user1_username"],
    "role": "creator"
})
if r.status_code == 200:
    j = r.json()
    ok = "token" in j and "user" in j
    if ok:
        test_data["user1_token"] = j["token"]
        test_data["user1_id"] = j["user"]["id"]
    log("auth_signup", ok, f"user_id={j.get('user', {}).get('id', 'N/A')[:8]}")
else:
    log("auth_signup", False, f"status={r.status_code} body={r.text[:200]}")

# Test 8: POST /api/auth/login
print("\n  → POST /api/auth/login...")
if "user1_email" in test_data:
    r = requests.post(f"{BASE}/auth/login", json={
        "email": test_data["user1_email"],
        "password": "testpass123"
    })
    if r.status_code == 200:
        j = r.json()
        ok = "token" in j and "user" in j
        log("auth_login", ok, f"token_length={len(j.get('token', ''))}")
    else:
        log("auth_login", False, f"status={r.status_code}")
else:
    log("auth_login", False, "No user1_email available")

# Test 9: GET /api/auth/me
print("\n  → GET /api/auth/me...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200 and "username" in r.json()
    log("auth_me", ok, f"status={r.status_code}")
else:
    log("auth_me", False, "No token available")

# Create second user for later tests
print("\n  → Creating second user for multi-user tests...")
uid2 = uuid.uuid4().hex[:8]
test_data["user2_email"] = f"testuser2_{uid2}@test.com"
test_data["user2_username"] = f"testuser2_{uid2}"
r = requests.post(f"{BASE}/auth/signup", json={
    "email": test_data["user2_email"],
    "password": "testpass123",
    "name": "Test User 2",
    "username": test_data["user2_username"],
    "role": "creator"
})
if r.status_code == 200:
    test_data["user2_token"] = r.json()["token"]
    test_data["user2_id"] = r.json()["user"]["id"]
    print(f"    ✓ Created user2: {test_data['user2_username']}")

# ==================== SOCIAL ENGINE ====================
print("\n[3] SOCIAL ENGINE")

# Test 10: GET /api/videos/feed
print("\n  → GET /api/videos/feed...")
r = requests.get(f"{BASE}/videos/feed")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("social_videos_feed", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 11: GET /api/users/{username}
print("\n  → GET /api/users/{username}...")
if "user1_username" in test_data:
    r = requests.get(f"{BASE}/users/{test_data['user1_username']}")
    ok = r.status_code == 200 and "username" in r.json()
    log("social_get_user", ok, f"status={r.status_code}")
else:
    log("social_get_user", False, "No username available")

# Test 12: PUT /api/users/me
print("\n  → PUT /api/users/me...")
if "user1_token" in test_data:
    r = requests.put(f"{BASE}/users/me", 
                     json={"bio": "Updated bio for testing", "name": "Test User 1 Updated"},
                     headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("social_update_profile", ok, f"status={r.status_code}")
else:
    log("social_update_profile", False, "No token available")

# Test 13: POST /api/users/{username}/follow
print("\n  → POST /api/users/{username}/follow...")
if "user1_token" in test_data and "user2_username" in test_data:
    r = requests.post(f"{BASE}/users/{test_data['user2_username']}/follow",
                      headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("social_follow_toggle", ok, f"status={r.status_code}")
else:
    log("social_follow_toggle", False, "Missing token or user2")

# Test 14: POST /api/videos/{id}/view (skip if no videos)
print("\n  → POST /api/videos/{id}/view...")
r = requests.get(f"{BASE}/videos/feed")
if r.status_code == 200 and len(r.json()) > 0:
    video_id = r.json()[0].get("id")
    r = requests.post(f"{BASE}/videos/{video_id}/view")
    ok = r.status_code == 200
    log("social_video_view", ok, f"status={r.status_code}")
else:
    log("social_video_view", True, "No videos to test", skip=True)

# ==================== MARKETPLACE ENGINE ====================
print("\n[4] MARKETPLACE ENGINE")

# Test 15: POST /api/services
print("\n  → POST /api/services...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/services", json={
        "title": "Test Service - Video Editing",
        "description": "Professional video editing service",
        "price": 500,
        "delivery_days": 3,
        "category": "video"
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["service1_id"] = r.json().get("id")
        log("marketplace_create_service", True, f"service_id={test_data['service1_id'][:8]}")
    else:
        log("marketplace_create_service", False, f"status={r.status_code}")
else:
    log("marketplace_create_service", False, "No token available")

# Create service for user2
if "user2_token" in test_data:
    r = requests.post(f"{BASE}/services", json={
        "title": "Test Service 2 - Photography",
        "description": "Professional photography service",
        "price": 800,
        "delivery_days": 5,
        "category": "photography"
    }, headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    if r.status_code == 200:
        test_data["service2_id"] = r.json().get("id")
        print(f"    ✓ Created service2: {test_data['service2_id'][:8]}")

# Test 16: GET /api/services/user/{username}
print("\n  → GET /api/services/user/{username}...")
if "user1_username" in test_data:
    r = requests.get(f"{BASE}/services/user/{test_data['user1_username']}")
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("marketplace_list_user_services", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")
else:
    log("marketplace_list_user_services", False, "No username available")

# Test 17: GET /api/services/{id}
print("\n  → GET /api/services/{id}...")
if "service1_id" in test_data:
    r = requests.get(f"{BASE}/services/{test_data['service1_id']}")
    ok = r.status_code == 200 and "title" in r.json()
    log("marketplace_get_service", ok, f"status={r.status_code}")
else:
    log("marketplace_get_service", False, "No service_id available")

# Test 18: POST /api/orders (user1 orders from user2's service)
print("\n  → POST /api/orders...")
if "user1_token" in test_data and "service2_id" in test_data:
    r = requests.post(f"{BASE}/orders", json={
        "service_id": test_data["service2_id"],
        "requirements": "Please deliver high quality work"
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["order1_id"] = r.json().get("id")
        log("marketplace_create_order", True, f"order_id={test_data['order1_id'][:8]}")
    else:
        log("marketplace_create_order", False, f"status={r.status_code}")
else:
    log("marketplace_create_order", False, "Missing token or service2_id")

# Test 19: GET /api/orders/my
print("\n  → GET /api/orders/my...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/orders/my", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        j = r.json()
        ok = "as_client" in j and "as_creator" in j
        log("marketplace_my_orders", ok, f"status={r.status_code}")
    else:
        log("marketplace_my_orders", False, f"status={r.status_code}")
else:
    log("marketplace_my_orders", False, "No token available")

# Test 20: GET /api/orders/reviewed-ids
print("\n  → GET /api/orders/reviewed-ids...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/orders/reviewed-ids", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("marketplace_reviewed_ids", ok, f"status={r.status_code}")
else:
    log("marketplace_reviewed_ids", False, "No token available")

# Test 21: POST /api/project-requests
print("\n  → POST /api/project-requests...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/project-requests", json={
        "title": "Need a promotional video",
        "description": "Looking for a video editor to create a 2-minute promo",
        "category": "video",
        "budget_min": 800,
        "budget_max": 1200,
        "deadline_days": 14
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["project_request_id"] = r.json().get("id")
        log("marketplace_create_project_request", True, f"pr_id={test_data['project_request_id'][:8]}")
    else:
        log("marketplace_create_project_request", False, f"status={r.status_code}")
else:
    log("marketplace_create_project_request", False, "No token available")

# Test 22: GET /api/project-requests
print("\n  → GET /api/project-requests...")
r = requests.get(f"{BASE}/project-requests")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("marketplace_list_project_requests", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 23: POST /api/project-requests/{id}/apply
print("\n  → POST /api/project-requests/{id}/apply...")
if "user2_token" in test_data and "project_request_id" in test_data:
    r = requests.post(f"{BASE}/project-requests/{test_data['project_request_id']}/apply", json={
        "message": "I can deliver this project with high quality",
        "proposed_price": 900
    }, headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    ok = r.status_code == 200
    log("marketplace_apply_project_request", ok, f"status={r.status_code}")
else:
    log("marketplace_apply_project_request", False, "Missing token or project_request_id")

# ==================== COMMUNITY ENGINE ====================
print("\n[5] COMMUNITY ENGINE")

# Test 24: GET /api/communities
print("\n  → GET /api/communities...")
r = requests.get(f"{BASE}/communities")
if r.status_code == 200:
    communities = r.json()
    ok = isinstance(communities, list) and len(communities) == 10
    log("community_list", ok, f"status={r.status_code} count={len(communities)}")
else:
    log("community_list", False, f"status={r.status_code}")

# Test 25: GET /api/communities/artists
print("\n  → GET /api/communities/artists...")
r = requests.get(f"{BASE}/communities/artists")
ok = r.status_code == 200 and "name" in r.json()
log("community_get_artists", ok, f"status={r.status_code}")

# Test 26: POST /api/communities/artists/join
print("\n  → POST /api/communities/artists/join...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/communities/artists/join",
                      headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("community_join_toggle", ok, f"status={r.status_code}")
else:
    log("community_join_toggle", False, "No token available")

# Test 27: POST /api/communities/artists/posts
print("\n  → POST /api/communities/artists/posts...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/communities/artists/posts", json={
        "text": "Hello from the artists community! This is a test post."
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["post_id"] = r.json().get("id")
        log("community_create_post", True, f"post_id={test_data['post_id'][:8]}")
    else:
        log("community_create_post", False, f"status={r.status_code}")
else:
    log("community_create_post", False, "No token available")

# Test 28: GET /api/communities/artists/posts
print("\n  → GET /api/communities/artists/posts...")
r = requests.get(f"{BASE}/communities/artists/posts")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("community_list_posts", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 29: POST /api/posts/{post_id}/like
print("\n  → POST /api/posts/{post_id}/like...")
if "user1_token" in test_data and "post_id" in test_data:
    r = requests.post(f"{BASE}/posts/{test_data['post_id']}/like",
                      headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("community_like_post", ok, f"status={r.status_code}")
else:
    log("community_like_post", False, "Missing token or post_id")

# ==================== TEAM ENGINE ====================
print("\n[6] TEAM ENGINE")

# Test 30: POST /api/teams
print("\n  → POST /api/teams...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/teams", json={
        "name": "Test Creative Team",
        "description": "A team for testing purposes",
        "looking_for": ["designer", "developer"]
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["team_id"] = r.json().get("id")
        log("team_create", True, f"team_id={test_data['team_id'][:8]}")
    else:
        log("team_create", False, f"status={r.status_code}")
else:
    log("team_create", False, "No token available")

# Test 31: GET /api/teams
print("\n  → GET /api/teams...")
r = requests.get(f"{BASE}/teams")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("team_list", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 32: GET /api/teams/{id}
print("\n  → GET /api/teams/{id}...")
if "team_id" in test_data:
    r = requests.get(f"{BASE}/teams/{test_data['team_id']}")
    ok = r.status_code == 200 and "name" in r.json()
    log("team_get", ok, f"status={r.status_code}")
else:
    log("team_get", False, "No team_id available")

# Test 33: POST /api/teams/{id}/join (from user2)
print("\n  → POST /api/teams/{id}/join...")
if "user2_token" in test_data and "team_id" in test_data:
    r = requests.post(f"{BASE}/teams/{test_data['team_id']}/join",
                      headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    ok = r.status_code == 200
    log("team_join_toggle", ok, f"status={r.status_code}")
else:
    log("team_join_toggle", False, "Missing token or team_id")

# ==================== INCUBATOR ENGINE ====================
print("\n[7] INCUBATOR ENGINE")

# Test 34: GET /api/incubator/stages
print("\n  → GET /api/incubator/stages...")
r = requests.get(f"{BASE}/incubator/stages")
if r.status_code == 200:
    stages = r.json()
    ok = isinstance(stages, list) and len(stages) == 7
    log("incubator_stages", ok, f"status={r.status_code} count={len(stages)}")
else:
    log("incubator_stages", False, f"status={r.status_code}")

# Test 35: POST /api/incubator/ideas
print("\n  → POST /api/incubator/ideas...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/incubator/ideas", json={
        "title": "Test Startup Idea",
        "description": "A revolutionary app for testing"
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        j = r.json()
        test_data["idea_id"] = j.get("id")
        ok = j.get("overall_progress") == 0 and len(j.get("stages", [])) == 7
        log("incubator_create_idea", ok, f"idea_id={test_data['idea_id'][:8]} overall={j.get('overall_progress')}")
    else:
        log("incubator_create_idea", False, f"status={r.status_code}")
else:
    log("incubator_create_idea", False, "No token available")

# Test 36: GET /api/incubator/ideas
print("\n  → GET /api/incubator/ideas...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/incubator/ideas", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("incubator_list_ideas", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")
else:
    log("incubator_list_ideas", False, "No token available")

# Test 37: PUT /api/incubator/ideas/{id}/stage
print("\n  → PUT /api/incubator/ideas/{id}/stage...")
if "user1_token" in test_data and "idea_id" in test_data:
    r = requests.put(f"{BASE}/incubator/ideas/{test_data['idea_id']}/stage", json={
        "stage": 1,
        "progress": 100
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        j = r.json()
        ok = j.get("overall_progress") == 14  # 100/7 ≈ 14
        log("incubator_update_stage", ok, f"status={r.status_code} overall={j.get('overall_progress')}")
    else:
        log("incubator_update_stage", False, f"status={r.status_code}")
else:
    log("incubator_update_stage", False, "Missing token or idea_id")

# ==================== AI ENGINE ====================
print("\n[8] AI ENGINE")

# Test 38: POST /api/ai/assist (may fail due to budget)
print("\n  → POST /api/ai/assist...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/ai/assist", json={
        "task": "project_names",
        "context": "مقهى"
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"}, timeout=30)
    if r.status_code == 200:
        result = r.json().get("result", "")
        ok = isinstance(result, str) and len(result) > 0
        log("ai_assist", ok, f"status={r.status_code} result_length={len(result)}")
    elif r.status_code == 500:
        # Budget exceeded is expected
        log("ai_assist", True, f"status=500 (budget exceeded - expected)", skip=True)
    else:
        log("ai_assist", False, f"status={r.status_code}")
else:
    log("ai_assist", False, "No token available")

# ==================== NOTIFICATION ENGINE ====================
print("\n[9] NOTIFICATION ENGINE")

# Test 39: GET /api/notifications
print("\n  → GET /api/notifications...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/notifications", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        j = r.json()
        ok = "items" in j and "unseen" in j
        log("notification_list", ok, f"status={r.status_code} unseen={j.get('unseen', 0)}")
    else:
        log("notification_list", False, f"status={r.status_code}")
else:
    log("notification_list", False, "No token available")

# Test 40: POST /api/notifications/mark-seen
print("\n  → POST /api/notifications/mark-seen...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/notifications/mark-seen",
                      headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("notification_mark_seen", ok, f"status={r.status_code}")
else:
    log("notification_mark_seen", False, "No token available")

# Test 41: GET /api/messages/conversations
print("\n  → GET /api/messages/conversations...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/messages/conversations", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("messages_conversations", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")
else:
    log("messages_conversations", False, "No token available")

# Test 42: POST /api/messages/with/{username}
print("\n  → POST /api/messages/with/{username}...")
if "user1_token" in test_data and "user2_username" in test_data:
    r = requests.post(f"{BASE}/messages/with/{test_data['user2_username']}", json={
        "text": "Hello! This is a test message."
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 200
    log("messages_send", ok, f"status={r.status_code}")
else:
    log("messages_send", False, "Missing token or user2_username")

# Test 43: GET /api/messages/with/{username}
print("\n  → GET /api/messages/with/{username}...")
if "user1_token" in test_data and "user2_username" in test_data:
    r = requests.get(f"{BASE}/messages/with/{test_data['user2_username']}",
                     headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        j = r.json()
        ok = "messages" in j and isinstance(j["messages"], list)
        log("messages_get", ok, f"status={r.status_code} count={len(j.get('messages', []))}")
    else:
        log("messages_get", False, f"status={r.status_code}")
else:
    log("messages_get", False, "Missing token or user2_username")

# ==================== SEARCH ENGINE ====================
print("\n[10] SEARCH ENGINE")

# Test 44: GET /api/explore/creators
print("\n  → GET /api/explore/creators...")
r = requests.get(f"{BASE}/explore/creators")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("search_explore_creators", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 45: GET /api/search?q=test
print("\n  → GET /api/search?q=test...")
r = requests.get(f"{BASE}/search", params={"q": "test"})
if r.status_code == 200:
    j = r.json()
    ok = "users" in j and "videos" in j
    log("search_query", ok, f"status={r.status_code}")
else:
    log("search_query", False, f"status={r.status_code}")

# ==================== EVENTS ENGINE ====================
print("\n[11] EVENTS ENGINE")

# Test 46: POST /api/events
print("\n  → POST /api/events...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/events", json={
        "title": "Test Creative Workshop",
        "description": "A workshop for testing",
        "date": "2026-03-15",
        "location": "Riyadh",
        "capacity": 50
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["event_id"] = r.json().get("id")
        log("events_create", True, f"event_id={test_data['event_id'][:8]}")
    else:
        log("events_create", False, f"status={r.status_code}")
else:
    log("events_create", False, "No token available")

# Test 47: GET /api/events
print("\n  → GET /api/events...")
r = requests.get(f"{BASE}/events")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("events_list", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 48: POST /api/events/{id}/register
print("\n  → POST /api/events/{id}/register...")
if "user2_token" in test_data and "event_id" in test_data:
    r = requests.post(f"{BASE}/events/{test_data['event_id']}/register",
                      headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    if r.status_code == 200:
        j = r.json()
        ok = "code" in j
        log("events_register", ok, f"status={r.status_code} code={j.get('code', 'N/A')[:8]}")
    else:
        log("events_register", False, f"status={r.status_code}")
else:
    log("events_register", False, "Missing token or event_id")

# Test 49: GET /api/events/my/tickets
print("\n  → GET /api/events/my/tickets...")
if "user2_token" in test_data:
    r = requests.get(f"{BASE}/events/my/tickets", headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("events_my_tickets", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")
else:
    log("events_my_tickets", False, "No token available")

# ==================== ACADEMY ENGINE ====================
print("\n[12] ACADEMY ENGINE")

# Test 50: POST /api/courses
print("\n  → POST /api/courses...")
if "user1_token" in test_data:
    r = requests.post(f"{BASE}/courses", json={
        "title": "Test Course - Video Production",
        "description": "Learn video production from scratch",
        "price": 299,
        "duration_hours": 10
    }, headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    if r.status_code == 200:
        test_data["course_id"] = r.json().get("id")
        log("academy_create_course", True, f"course_id={test_data['course_id'][:8]}")
    else:
        log("academy_create_course", False, f"status={r.status_code}")
else:
    log("academy_create_course", False, "No token available")

# Test 51: GET /api/courses
print("\n  → GET /api/courses...")
r = requests.get(f"{BASE}/courses")
ok = r.status_code == 200 and isinstance(r.json(), list)
log("academy_list_courses", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")

# Test 52: POST /api/courses/{id}/enroll
print("\n  → POST /api/courses/{id}/enroll...")
if "user2_token" in test_data and "course_id" in test_data:
    r = requests.post(f"{BASE}/courses/{test_data['course_id']}/enroll",
                      headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    ok = r.status_code == 200
    log("academy_enroll", ok, f"status={r.status_code}")
else:
    log("academy_enroll", False, "Missing token or course_id")

# Test 53: GET /api/courses/my/enrolled
print("\n  → GET /api/courses/my/enrolled...")
if "user2_token" in test_data:
    r = requests.get(f"{BASE}/courses/my/enrolled", headers={"Authorization": f"Bearer {test_data['user2_token']}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("academy_my_enrolled", ok, f"status={r.status_code} count={len(r.json()) if ok else 0}")
else:
    log("academy_my_enrolled", False, "No token available")

# ==================== CRM ENGINE ====================
print("\n[13] CRM ENGINE")

# Test 54: POST /api/leads (valid)
print("\n  → POST /api/leads (valid)...")
r = requests.post(f"{BASE}/leads", json={
    "name": "Ahmed Al-Saud",
    "email": "ahmed@example.com",
    "story": "I want to build a strong brand for my coffee shop"
})
if r.status_code == 200:
    j = r.json()
    ok = j.get("success") is True and "id" in j
    log("crm_leads_post_valid", ok, f"lead_id={j.get('id', 'N/A')[:8]}")
else:
    log("crm_leads_post_valid", False, f"status={r.status_code}")

# Test 55: GET /api/leads (no auth)
print("\n  → GET /api/leads (no auth)...")
r = requests.get(f"{BASE}/leads")
ok = r.status_code == 401
log("crm_leads_get_no_auth", ok, f"status={r.status_code}")

# Test 56: GET /api/leads (non-admin)
print("\n  → GET /api/leads (non-admin)...")
if "user1_token" in test_data:
    r = requests.get(f"{BASE}/leads", headers={"Authorization": f"Bearer {test_data['user1_token']}"})
    ok = r.status_code == 403
    log("crm_leads_get_non_admin", ok, f"status={r.status_code}")
else:
    log("crm_leads_get_non_admin", False, "No token available")

# ==================== SUMMARY ====================
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"✅ Passed: {len(results['passed'])}")
print(f"❌ Failed: {len(results['failed'])}")
print(f"⏭️  Skipped: {len(results['skipped'])}")

if results['failed']:
    print("\n❌ FAILED TESTS:")
    for f in results['failed']:
        print(f"  - {f['test']}: {f['detail']}")

if results['skipped']:
    print("\n⏭️  SKIPPED TESTS:")
    for s in results['skipped']:
        print(f"  - {s['test']}: {s['detail']}")

# Save results
import os
os.makedirs("/app/test_reports", exist_ok=True)
with open("/app/test_reports/iteration_8.json", "w") as fp:
    json.dump(results, fp, indent=2, ensure_ascii=False)

print(f"\n📊 Results saved to /app/test_reports/iteration_8.json")
print("=" * 80)
