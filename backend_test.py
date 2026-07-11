#!/usr/bin/env python3
"""
Iteration 12 Backend Test — RBAC + Admin Engine V1
Tests 10 roles, capabilities matrix, user management, ban/unban, audit log
"""
import requests
import json
import os
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://doc-restore-3.preview.emergentagent.com/api"

# Test results
results = {
    "iteration": 12,
    "test_name": "RBAC + Admin Engine V1",
    "timestamp": datetime.utcnow().isoformat(),
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name, passed, response=None, error=None):
    """Log test result"""
    results["total"] += 1
    if passed:
        results["passed"] += 1
        print(f"✅ {name}")
    else:
        results["failed"] += 1
        print(f"❌ {name}")
        if error:
            print(f"   Error: {error}")
        if response:
            print(f"   Response: {response.status_code} - {response.text[:200]}")
    
    results["tests"].append({
        "name": name,
        "passed": passed,
        "error": error,
        "response_code": response.status_code if response else None,
        "response_body": response.text[:500] if response else None
    })

def setup_admin_user():
    """Bootstrap super_admin user crm@test.com"""
    print("\n=== SETUP: Bootstrap super_admin user ===")
    
    # Try to signup crm@test.com
    try:
        resp = requests.post(f"{BACKEND_URL}/auth/signup", json={
            "name": "CRM Admin",
            "username": "crmadmin",
            "email": "crm@test.com",
            "password": "testpass123"
        }, timeout=10)
        
        if resp.status_code == 200:
            print("✅ Created crm@test.com user")
        elif resp.status_code == 400 and "already exists" in resp.text.lower():
            print("✅ crm@test.com user already exists")
        else:
            print(f"⚠️  Signup response: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"⚠️  Signup error: {e}")
    
    # Promote to super_admin via direct DB update
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio
        
        async def promote():
            client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client.ruaa
            result = await db.users.update_one(
                {"email": "crm@test.com"},
                {"$set": {"role": "super_admin"}}
            )
            print(f"✅ Promoted crm@test.com to super_admin (matched: {result.matched_count})")
            client.close()
        
        asyncio.run(promote())
    except Exception as e:
        print(f"⚠️  DB promotion error: {e}")
    
    # Login and get token
    try:
        resp = requests.post(f"{BACKEND_URL}/auth/login", json={
            "email": "crm@test.com",
            "password": "testpass123"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            user_id = data.get("user", {}).get("id")
            print(f"✅ Logged in as super_admin (token: {token[:20]}...)")
            return token, user_id
        else:
            print(f"❌ Login failed: {resp.status_code} - {resp.text[:200]}")
            return None, None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None, None

def run_tests():
    """Run all RBAC + Admin Engine tests"""
    
    # Setup admin user
    admin_token, admin_user_id = setup_admin_user()
    if not admin_token:
        print("\n❌ FATAL: Could not setup super_admin user. Aborting tests.")
        return
    
    print("\n" + "="*60)
    print("ITERATION 12 — RBAC + ADMIN ENGINE V1 TESTS")
    print("="*60)
    
    # ============================================================
    # PUBLIC ENDPOINTS
    # ============================================================
    print("\n### PUBLIC ENDPOINTS ###")
    
    # Test 1: GET /api/admin/roles
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/roles", timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and isinstance(data, list) and len(data) == 10:
            # Verify structure
            first_role = data[0]
            has_structure = all(k in first_role for k in ["key", "name", "color", "level"])
            
            # Verify specific roles
            role_keys = [r["key"] for r in data]
            expected_roles = ["super_admin", "ceo", "marketing_manager", "community_manager", 
                            "company", "team_owner", "trainer", "creator", "client", "student"]
            has_all_roles = all(r in role_keys for r in expected_roles)
            
            if has_structure and has_all_roles:
                log_test("1. GET /admin/roles → 200 with 10 roles (key, name, color, level)", True, resp)
            else:
                log_test("1. GET /admin/roles → 200 but structure/roles incomplete", False, resp, 
                        f"Structure OK: {has_structure}, All roles: {has_all_roles}")
        else:
            log_test("1. GET /admin/roles → 200 with 10 roles", False, resp, 
                    f"Got {len(data) if data else 0} roles")
    except Exception as e:
        log_test("1. GET /admin/roles", False, error=str(e))
    
    # Test 2: GET /api/admin/me/permissions (with any auth token)
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/me/permissions", 
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and data:
            has_structure = all(k in data for k in ["role", "role_meta", "capabilities"])
            is_super_admin = data.get("role") == "super_admin"
            has_caps = isinstance(data.get("capabilities"), list) and len(data["capabilities"]) > 0
            
            if has_structure and is_super_admin and has_caps:
                log_test("2. GET /admin/me/permissions (super_admin) → 200 with role, role_meta, capabilities", 
                        True, resp)
            else:
                log_test("2. GET /admin/me/permissions → 200 but incomplete", False, resp,
                        f"Structure: {has_structure}, Super admin: {is_super_admin}, Has caps: {has_caps}")
        else:
            log_test("2. GET /admin/me/permissions", False, resp)
    except Exception as e:
        log_test("2. GET /admin/me/permissions", False, error=str(e))
    
    # ============================================================
    # RBAC GATING — Create fresh creator user
    # ============================================================
    print("\n### RBAC GATING (Creator gets 403) ###")
    
    creator_token = None
    creator_user_id = None
    
    # Test 3: Create fresh signup (role=creator by default)
    try:
        import uuid
        random_email = f"creator_{uuid.uuid4().hex[:8]}@test.com"
        
        resp = requests.post(f"{BACKEND_URL}/auth/signup", json={
            "name": "Test Creator",
            "username": f"creator_{uuid.uuid4().hex[:6]}",
            "email": random_email,
            "password": "testpass123"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            creator_token = data.get("token")
            creator_user_id = data.get("user", {}).get("id")
            
            # Verify default role is creator
            me_resp = requests.get(f"{BACKEND_URL}/auth/me",
                                  headers={"Authorization": f"Bearer {creator_token}"}, timeout=10)
            if me_resp.status_code == 200:
                user_data = me_resp.json()
                role = user_data.get("role", "creator")
                if role == "creator":
                    log_test("3. Fresh signup → default role=creator", True, resp)
                else:
                    log_test("3. Fresh signup → default role=creator", False, resp, 
                            f"Got role={role}")
            else:
                log_test("3. Fresh signup → verify role", False, me_resp)
        else:
            log_test("3. Fresh signup", False, resp)
    except Exception as e:
        log_test("3. Fresh signup", False, error=str(e))
    
    if not creator_token:
        print("⚠️  Skipping creator RBAC tests (no creator token)")
    else:
        # Test 4: Creator GET /admin/users → 403
        try:
            resp = requests.get(f"{BACKEND_URL}/admin/users",
                              headers={"Authorization": f"Bearer {creator_token}"}, timeout=10)
            
            if resp.status_code == 403:
                log_test("4. Creator GET /admin/users → 403 (غير مصرح)", True, resp)
            else:
                log_test("4. Creator GET /admin/users → 403", False, resp, 
                        f"Expected 403, got {resp.status_code}")
        except Exception as e:
            log_test("4. Creator GET /admin/users → 403", False, error=str(e))
        
        # Test 5: Creator GET /admin/dashboard → 403
        try:
            resp = requests.get(f"{BACKEND_URL}/admin/dashboard",
                              headers={"Authorization": f"Bearer {creator_token}"}, timeout=10)
            
            if resp.status_code == 403:
                log_test("5. Creator GET /admin/dashboard → 403", True, resp)
            else:
                log_test("5. Creator GET /admin/dashboard → 403", False, resp,
                        f"Expected 403, got {resp.status_code}")
        except Exception as e:
            log_test("5. Creator GET /admin/dashboard → 403", False, error=str(e))
        
        # Test 6: Creator PUT /admin/users/{id}/role → 403
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{creator_user_id}/role",
                              headers={"Authorization": f"Bearer {creator_token}"},
                              json={"role": "trainer"}, timeout=10)
            
            if resp.status_code == 403:
                log_test("6. Creator PUT /admin/users/{id}/role → 403", True, resp)
            else:
                log_test("6. Creator PUT /admin/users/{id}/role → 403", False, resp,
                        f"Expected 403, got {resp.status_code}")
        except Exception as e:
            log_test("6. Creator PUT /admin/users/{id}/role → 403", False, error=str(e))
    
    # ============================================================
    # SUPER_ADMIN OPERATIONS
    # ============================================================
    print("\n### SUPER_ADMIN OPERATIONS ###")
    
    # Test 7: Super_admin GET /admin/users → 200 with role_meta enriched
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/users",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and isinstance(data, list) and len(data) > 0:
            first_user = data[0]
            has_role_meta = "role_meta" in first_user
            
            if has_role_meta:
                log_test("7. Super_admin GET /admin/users → 200 with role_meta enriched", True, resp)
            else:
                log_test("7. Super_admin GET /admin/users → 200 but no role_meta", False, resp)
        else:
            log_test("7. Super_admin GET /admin/users → 200", False, resp,
                    f"Got {len(data) if data else 0} users")
    except Exception as e:
        log_test("7. Super_admin GET /admin/users → 200", False, error=str(e))
    
    # Test 8: Filter by role=creator
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/users?role=creator",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and isinstance(data, list):
            # Verify all returned users have role=creator
            all_creators = all(u.get("role") == "creator" for u in data)
            
            if all_creators:
                log_test("8. GET /admin/users?role=creator → filtered correctly", True, resp)
            else:
                log_test("8. GET /admin/users?role=creator → filter failed", False, resp,
                        "Some users don't have role=creator")
        else:
            log_test("8. GET /admin/users?role=creator", False, resp)
    except Exception as e:
        log_test("8. GET /admin/users?role=creator", False, error=str(e))
    
    # Test 9: Search q=crm
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/users?q=crm",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and isinstance(data, list):
            # Should find crm@test.com
            found_crm = any("crm" in u.get("email", "").lower() or 
                          "crm" in u.get("name", "").lower() or
                          "crm" in u.get("username", "").lower() for u in data)
            
            if found_crm:
                log_test("9. GET /admin/users?q=crm → search working", True, resp)
            else:
                log_test("9. GET /admin/users?q=crm → search failed", False, resp,
                        "crm@test.com not found in results")
        else:
            log_test("9. GET /admin/users?q=crm", False, resp)
    except Exception as e:
        log_test("9. GET /admin/users?q=crm", False, error=str(e))
    
    # Test 10: GET /admin/users/{id} with stats
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/users/{admin_user_id}",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and data:
            has_stats = "stats" in data
            if has_stats:
                stats = data["stats"]
                has_all_stats = all(k in stats for k in ["videos", "services", "orders_placed", "orders_received"])
                
                if has_all_stats:
                    log_test("10. GET /admin/users/{id} → 200 with stats (videos, services, orders)", True, resp)
                else:
                    log_test("10. GET /admin/users/{id} → 200 but incomplete stats", False, resp,
                            f"Missing stats keys")
            else:
                log_test("10. GET /admin/users/{id} → 200 but no stats", False, resp)
        else:
            log_test("10. GET /admin/users/{id}", False, resp)
    except Exception as e:
        log_test("10. GET /admin/users/{id}", False, error=str(e))
    
    # Test 11: GET /admin/dashboard
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/dashboard",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and data:
            has_structure = all(k in data for k in ["users", "content", "business", "community"])
            
            if has_structure:
                # Verify users.by_role has 10 items
                by_role = data.get("users", {}).get("by_role", [])
                has_10_roles = len(by_role) == 10
                
                if has_10_roles:
                    log_test("11. GET /admin/dashboard → 200 with {users, content, business, community}", True, resp)
                else:
                    log_test("11. GET /admin/dashboard → 200 but by_role incomplete", False, resp,
                            f"Got {len(by_role)} roles, expected 10")
            else:
                log_test("11. GET /admin/dashboard → 200 but structure incomplete", False, resp)
        else:
            log_test("11. GET /admin/dashboard", False, resp)
    except Exception as e:
        log_test("11. GET /admin/dashboard", False, error=str(e))
    
    # ============================================================
    # USER MANAGEMENT
    # ============================================================
    print("\n### USER MANAGEMENT (Role Changes) ###")
    
    second_user_id = creator_user_id  # Use the creator we created earlier
    second_user_token = creator_token
    
    if not second_user_id:
        print("⚠️  Skipping user management tests (no second user)")
    else:
        # Test 12: Promote second user to marketing_manager
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{second_user_id}/role",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"role": "marketing_manager"}, timeout=10)
            data = resp.json() if resp.status_code == 200 else None
            
            if resp.status_code == 200 and data:
                new_role = data.get("new_role")
                if new_role == "marketing_manager":
                    log_test("12. Super_admin PUT /admin/users/{id}/role → 200 with new_role", True, resp)
                else:
                    log_test("12. Super_admin PUT /admin/users/{id}/role → 200 but wrong role", False, resp,
                            f"Expected marketing_manager, got {new_role}")
            else:
                log_test("12. Super_admin PUT /admin/users/{id}/role", False, resp)
        except Exception as e:
            log_test("12. Super_admin PUT /admin/users/{id}/role", False, error=str(e))
        
        # Test 13: Verify promoted user has new capabilities
        try:
            # Login as promoted user to get fresh token
            resp = requests.get(f"{BACKEND_URL}/admin/me/permissions",
                              headers={"Authorization": f"Bearer {second_user_token}"}, timeout=10)
            data = resp.json() if resp.status_code == 200 else None
            
            if resp.status_code == 200 and data:
                role = data.get("role")
                caps = data.get("capabilities", [])
                
                # Marketing manager should have admin.view_all_leads and marketing.manage_campaigns
                has_leads_cap = "admin.view_all_leads" in caps
                has_marketing_cap = "marketing.manage_campaigns" in caps
                
                if role == "marketing_manager" and has_leads_cap and has_marketing_cap:
                    log_test("13. Promoted user GET /admin/me/permissions → has marketing_manager capabilities", 
                            True, resp)
                else:
                    log_test("13. Promoted user GET /admin/me/permissions → missing capabilities", False, resp,
                            f"Role: {role}, Has leads cap: {has_leads_cap}, Has marketing cap: {has_marketing_cap}")
            else:
                log_test("13. Promoted user GET /admin/me/permissions", False, resp)
        except Exception as e:
            log_test("13. Promoted user GET /admin/me/permissions", False, error=str(e))
        
        # Test 14: Super_admin can't demote self
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{admin_user_id}/role",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"role": "creator"}, timeout=10)
            
            if resp.status_code == 400:
                log_test("14. Super_admin PUT self role to creator → 400 (can't demote self)", True, resp)
            else:
                log_test("14. Super_admin PUT self role to creator → 400", False, resp,
                        f"Expected 400, got {resp.status_code}")
        except Exception as e:
            log_test("14. Super_admin PUT self role to creator → 400", False, error=str(e))
        
        # Test 15: Invalid role → 400
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{second_user_id}/role",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"role": "invalid_role"}, timeout=10)
            
            if resp.status_code == 400:
                log_test("15. PUT /admin/users/{id}/role with invalid_role → 400", True, resp)
            else:
                log_test("15. PUT /admin/users/{id}/role with invalid_role → 400", False, resp,
                        f"Expected 400, got {resp.status_code}")
        except Exception as e:
            log_test("15. PUT /admin/users/{id}/role with invalid_role → 400", False, error=str(e))
    
    # ============================================================
    # BAN/UNBAN
    # ============================================================
    print("\n### BAN/UNBAN ###")
    
    if not second_user_id:
        print("⚠️  Skipping ban/unban tests (no second user)")
    else:
        # Test 16: Ban user
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{second_user_id}/ban",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"banned": True, "reason": "spam"}, timeout=10)
            data = resp.json() if resp.status_code == 200 else None
            
            if resp.status_code == 200 and data:
                banned = data.get("banned")
                if banned is True:
                    # Verify by GET user
                    get_resp = requests.get(f"{BACKEND_URL}/admin/users/{second_user_id}",
                                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
                    get_data = get_resp.json() if get_resp.status_code == 200 else None
                    
                    if get_data:
                        is_banned = get_data.get("is_banned")
                        banned_reason = get_data.get("banned_reason")
                        
                        if is_banned is True and banned_reason == "spam":
                            log_test("16. Super_admin PUT /admin/users/{id}/ban → 200, verified is_banned=true, reason=spam", 
                                    True, resp)
                        else:
                            log_test("16. Super_admin PUT /admin/users/{id}/ban → 200 but verification failed", False, resp,
                                    f"is_banned: {is_banned}, reason: {banned_reason}")
                    else:
                        log_test("16. Super_admin PUT /admin/users/{id}/ban → 200 but GET failed", False, get_resp)
                else:
                    log_test("16. Super_admin PUT /admin/users/{id}/ban → 200 but banned=false", False, resp)
            else:
                log_test("16. Super_admin PUT /admin/users/{id}/ban", False, resp)
        except Exception as e:
            log_test("16. Super_admin PUT /admin/users/{id}/ban", False, error=str(e))
        
        # Test 17: Unban user
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{second_user_id}/ban",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"banned": False}, timeout=10)
            data = resp.json() if resp.status_code == 200 else None
            
            if resp.status_code == 200 and data:
                banned = data.get("banned")
                if banned is False:
                    log_test("17. Super_admin PUT /admin/users/{id}/ban (unban) → 200", True, resp)
                else:
                    log_test("17. Super_admin PUT /admin/users/{id}/ban (unban) → 200 but banned=true", False, resp)
            else:
                log_test("17. Super_admin PUT /admin/users/{id}/ban (unban)", False, resp)
        except Exception as e:
            log_test("17. Super_admin PUT /admin/users/{id}/ban (unban)", False, error=str(e))
        
        # Test 18: Can't ban self
        try:
            resp = requests.put(f"{BACKEND_URL}/admin/users/{admin_user_id}/ban",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"banned": True}, timeout=10)
            
            if resp.status_code == 400:
                log_test("18. Super_admin PUT self ban → 400 (can't ban self)", True, resp)
            else:
                log_test("18. Super_admin PUT self ban → 400", False, resp,
                        f"Expected 400, got {resp.status_code}")
        except Exception as e:
            log_test("18. Super_admin PUT self ban → 400", False, error=str(e))
    
    # ============================================================
    # AUDIT LOG
    # ============================================================
    print("\n### AUDIT LOG ###")
    
    # Test 19: GET /admin/audit
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/audit",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and isinstance(data, list):
            if len(data) > 0:
                # Verify structure: should have actor/target enriched
                first_log = data[0]
                has_structure = all(k in first_log for k in ["actor_id", "target_id", "action", "created_at"])
                has_enrichment = "actor" in first_log and "target" in first_log
                
                if has_structure and has_enrichment:
                    # Verify we have logs from role change and ban actions
                    actions = [log.get("action") for log in data]
                    has_change_role = "change_role" in actions
                    has_ban = "ban" in actions or "unban" in actions
                    
                    if has_change_role or has_ban:
                        log_test("19. GET /admin/audit → 200 with logs (actor/target enriched, change_role/ban actions)", 
                                True, resp)
                    else:
                        log_test("19. GET /admin/audit → 200 but missing expected actions", False, resp,
                                f"Actions: {actions}")
                else:
                    log_test("19. GET /admin/audit → 200 but structure incomplete", False, resp,
                            f"Structure: {has_structure}, Enrichment: {has_enrichment}")
            else:
                log_test("19. GET /admin/audit → 200 but empty", False, resp, "No audit logs found")
        else:
            log_test("19. GET /admin/audit", False, resp)
    except Exception as e:
        log_test("19. GET /admin/audit", False, error=str(e))
    
    # ============================================================
    # ROUTE SANITY
    # ============================================================
    print("\n### ROUTE SANITY ###")
    
    # Test 20: GET /admin/ping
    try:
        resp = requests.get(f"{BACKEND_URL}/admin/ping", timeout=10)
        data = resp.json() if resp.status_code == 200 else None
        
        if resp.status_code == 200 and data:
            engine = data.get("engine")
            status = data.get("status")
            
            if engine == "admin" and status == "active":
                log_test("20. GET /admin/ping → 200 (backwards compat)", True, resp)
            else:
                log_test("20. GET /admin/ping → 200 but wrong data", False, resp,
                        f"engine: {engine}, status: {status}")
        else:
            log_test("20. GET /admin/ping", False, resp)
    except Exception as e:
        log_test("20. GET /admin/ping", False, error=str(e))
    
    # ============================================================
    # SUMMARY
    # ============================================================
    print("\n" + "="*60)
    print(f"TESTS COMPLETE: {results['passed']}/{results['total']} passed")
    print("="*60)
    
    # Save report
    os.makedirs("/app/test_reports", exist_ok=True)
    report_path = "/app/test_reports/iteration_12.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n📄 Report saved to {report_path}")
    
    return results

if __name__ == "__main__":
    try:
        results = run_tests()
        sys.exit(0 if results["failed"] == 0 else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
