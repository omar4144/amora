"""
Iteration 11 — Tasks Engine V1 Full Backend Test
~30 test scenarios covering:
- Meta (statuses, priorities)
- Boards CRUD (personal/team, user isolation)
- Tasks CRUD (validation, filters, search)
- Checklist operations
- My Tasks
- Kanban view
- Stats
- Team board sharing
- Route order sanity
- Cascade delete
"""
import requests
import json
import os
import time
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BACKEND_URL = "https://doc-restore-3.preview.emergentagent.com/api"

# Test results
results = []
def log_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    # Ensure details is a string
    details_str = str(details) if details else ""
    results.append({"test": name, "passed": passed, "details": details_str})
    print(f"{status} | {name}")
    if details_str and not passed:
        print(f"   Details: {details_str}")
    # Small delay to avoid overwhelming the server
    time.sleep(0.1)

# Helper to make requests
def req(method, path, json_data=None, token=None, params=None):
    url = f"{BACKEND_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, params=params, timeout=15)
        elif method == "POST":
            r = requests.post(url, json=json_data, headers=headers, timeout=15)
        elif method == "PUT":
            r = requests.put(url, json=json_data, headers=headers, timeout=15)
        elif method == "DELETE":
            r = requests.delete(url, headers=headers, timeout=15)
        return r
    except requests.exceptions.Timeout:
        print(f"   ⚠️  Request timeout for {method} {path}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Request error for {method} {path}: {str(e)[:100]}")
        return None
    except Exception as e:
        print(f"   ⚠️  Unexpected error for {method} {path}: {str(e)[:100]}")
        return None

print("=" * 80)
print("ITERATION 11 — TASKS ENGINE V1 FULL BACKEND TEST")
print("=" * 80)

# ==================== SETUP: Create 2 users ====================
print("\n[SETUP] Creating test users...")

# User 1
r1 = req("POST", "/auth/signup", {
    "name": "Layla Tasks",
    "username": f"layla_tasks_{datetime.now().timestamp()}",
    "email": f"layla_tasks_{datetime.now().timestamp()}@test.com",
    "password": "testpass123",
    "role": "creator"
})
if not r1 or r1.status_code != 200:
    print("❌ Failed to create user 1")
    exit(1)
user1 = r1.json()
token1 = user1["token"]
user1_id = user1["user"]["id"]
print(f"✅ User 1 created: {user1['user']['username']}")

# User 2
r2 = req("POST", "/auth/signup", {
    "name": "Noor Tasks",
    "username": f"noor_tasks_{datetime.now().timestamp()}",
    "email": f"noor_tasks_{datetime.now().timestamp()}@test.com",
    "password": "testpass123",
    "role": "creator"
})
if not r2 or r2.status_code != 200:
    print("❌ Failed to create user 2")
    exit(1)
user2 = r2.json()
token2 = user2["token"]
user2_id = user2["user"]["id"]
print(f"✅ User 2 created: {user2['user']['username']}")

# ==================== TEST 1: Meta endpoint ====================
print("\n[TEST 1] GET /tasks/meta")
r = req("GET", "/tasks/meta", token=token1)
if r and r.status_code == 200:
    data = r.json()
    statuses = data.get("statuses", [])
    priorities = data.get("priorities", [])
    expected_statuses = ["todo", "in_progress", "review", "blocked", "done"]
    expected_priorities = ["low", "medium", "high", "urgent"]
    status_keys = [s["key"] for s in statuses]
    priority_keys = [p["key"] for p in priorities]
    passed = (len(statuses) == 5 and len(priorities) == 4 and 
              all(k in status_keys for k in expected_statuses) and
              all(k in priority_keys for k in expected_priorities))
    log_test("Meta endpoint returns 5 statuses and 4 priorities", passed, 
             f"Got {len(statuses)} statuses, {len(priorities)} priorities")
else:
    log_test("Meta endpoint returns 5 statuses and 4 priorities", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 2: Boards - empty list ====================
print("\n[TEST 2] GET /tasks/boards (empty)")
r = req("GET", "/tasks/boards", token=token1)
if r and r.status_code == 200:
    boards = r.json()
    log_test("User 1 boards list initially empty", len(boards) == 0, 
             f"Got {len(boards)} boards")
else:
    log_test("User 1 boards list initially empty", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 3: Create personal board ====================
print("\n[TEST 3] POST /tasks/boards (personal)")
r = req("POST", "/tasks/boards", {
    "name": "My Personal Board",
    "description": "Personal tasks for Layla",
    "color": "#E3FF00",
    "kind": "personal"
}, token=token1)
if r and r.status_code == 200:
    board1 = r.json()
    board1_id = board1.get("id")
    passed = (board1.get("name") == "My Personal Board" and 
              board1.get("kind") == "personal" and
              board1.get("owner_id") == user1_id and
              board1.get("tasks_count") == 0 and
              board1.get("done_count") == 0)
    log_test("Create personal board with correct fields", passed, 
             f"Board ID: {board1_id}")
else:
    log_test("Create personal board with correct fields", False, 
             f"Status: {r.status_code if r else 'No response'}")
    board1_id = None

# ==================== TEST 4: Create team board without team_id ====================
print("\n[TEST 4] POST /tasks/boards (team without team_id)")
r = req("POST", "/tasks/boards", {
    "name": "Team Board",
    "kind": "team"
}, token=token1)
log_test("Create team board without team_id returns 400", 
         r and r.status_code == 400,
         f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 5: Create team and team board ====================
print("\n[TEST 5] Create team and team board")
# Create team
r = req("POST", "/teams", {
    "name": "Layla's Team",
    "description": "Test team for tasks"
}, token=token1)
if r and r.status_code == 200:
    team1 = r.json()
    team1_id = team1.get("id")
    print(f"   Team created: {team1_id}")
    
    # Create team board
    r = req("POST", "/tasks/boards", {
        "name": "Team Board",
        "description": "Shared team tasks",
        "color": "#3B82F6",
        "kind": "team",
        "team_id": team1_id
    }, token=token1)
    if r and r.status_code == 200:
        team_board = r.json()
        team_board_id = team_board.get("id")
        passed = (team_board.get("kind") == "team" and 
                  team_board.get("team_id") == team1_id and
                  team_board.get("owner_id") == user1_id)
        log_test("Create team board with valid team_id", passed, 
                 f"Team board ID: {team_board_id}")
    else:
        log_test("Create team board with valid team_id", False, 
                 f"Status: {r.status_code if r else 'No response'}")
        team_board_id = None
else:
    log_test("Create team and team board", False, "Failed to create team")
    team1_id = None
    team_board_id = None

# ==================== TEST 6: User 2 tries to create board with User 1's team ====================
print("\n[TEST 6] User 2 creates board with User 1's team (should fail)")
if team1_id:
    r = req("POST", "/tasks/boards", {
        "name": "Unauthorized Board",
        "kind": "team",
        "team_id": team1_id
    }, token=token2)
    log_test("Non-member cannot create team board", 
             r and r.status_code == 403,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Non-member cannot create team board", False, "No team to test with")

# ==================== TEST 7: GET board with enrichment ====================
print("\n[TEST 7] GET /tasks/boards/{id}")
if board1_id:
    r = req("GET", f"/tasks/boards/{board1_id}", token=token1)
    if r and r.status_code == 200:
        board = r.json()
        passed = ("tasks_count" in board and "done_count" in board and
                  board.get("id") == board1_id)
        log_test("Get board returns enriched data", passed)
    else:
        log_test("Get board returns enriched data", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Get board returns enriched data", False, "No board to test with")

# ==================== TEST 8: Update board ====================
print("\n[TEST 8] PUT /tasks/boards/{id}")
if board1_id:
    r = req("PUT", f"/tasks/boards/{board1_id}", {
        "description": "Updated description for personal board"
    }, token=token1)
    if r and r.status_code == 200:
        board = r.json()
        log_test("Update board description", 
                 board.get("description") == "Updated description for personal board")
    else:
        log_test("Update board description", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Update board description", False, "No board to test with")

# ==================== TEST 9: Create task with invalid board_id ====================
print("\n[TEST 9] POST /tasks (invalid board_id)")
r = req("POST", "/tasks", {
    "board_id": "invalid-board-id",
    "title": "Test Task"
}, token=token1)
log_test("Create task with invalid board_id returns 404", 
         r and r.status_code == 404,
         f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 10: Create task with invalid status ====================
print("\n[TEST 10] POST /tasks (invalid status)")
if board1_id:
    r = req("POST", "/tasks", {
        "board_id": board1_id,
        "title": "Test Task",
        "status": "bad_status"
    }, token=token1)
    log_test("Create task with invalid status returns 400", 
             r and r.status_code == 400,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Create task with invalid status returns 400", False, "No board to test with")

# ==================== TEST 11: Create task with invalid priority ====================
print("\n[TEST 11] POST /tasks (invalid priority)")
if board1_id:
    r = req("POST", "/tasks", {
        "board_id": board1_id,
        "title": "Test Task",
        "priority": "unknown"
    }, token=token1)
    log_test("Create task with invalid priority returns 400", 
             r and r.status_code == 400,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Create task with invalid priority returns 400", False, "No board to test with")

# ==================== TEST 12: Create valid task ====================
print("\n[TEST 12] POST /tasks (valid)")
if board1_id:
    due_date = (datetime.now() + timedelta(days=7)).isoformat()
    r = req("POST", "/tasks", {
        "board_id": board1_id,
        "title": "Design new landing page",
        "description": "Create mockups for agency landing",
        "priority": "high",
        "due_date": due_date,
        "checklist": [
            {"text": "Research competitors", "done": False},
            {"text": "Create wireframes", "done": False}
        ]
    }, token=token1)
    if r and r.status_code == 200:
        task1 = r.json()
        task1_id = task1.get("id")
        passed = (task1.get("title") == "Design new landing page" and
                  task1.get("owner_id") == user1_id and
                  task1.get("status") == "todo" and
                  task1.get("priority") == "high" and
                  len(task1.get("checklist", [])) == 2 and
                  "created_at" in task1 and
                  "updated_at" in task1)
        log_test("Create valid task with checklist", passed, f"Task ID: {task1_id}")
    else:
        log_test("Create valid task with checklist", False, 
                 f"Status: {r.status_code if r else 'No response'}")
        task1_id = None
else:
    log_test("Create valid task with checklist", False, "No board to test with")
    task1_id = None

# ==================== TEST 13: List tasks by board ====================
print("\n[TEST 13] GET /tasks?board_id={id}")
if board1_id:
    r = req("GET", "/tasks", token=token1, params={"board_id": board1_id})
    if r and r.status_code == 200:
        tasks = r.json()
        log_test("List tasks by board_id", len(tasks) == 1, f"Got {len(tasks)} tasks")
    else:
        log_test("List tasks by board_id", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("List tasks by board_id", False, "No board to test with")

# ==================== TEST 14: Get single task ====================
print("\n[TEST 14] GET /tasks/{task_id}")
if task1_id:
    r = req("GET", f"/tasks/{task1_id}", token=token1)
    if r and r.status_code == 200:
        task = r.json()
        log_test("Get single task", task.get("id") == task1_id)
    else:
        log_test("Get single task", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Get single task", False, "No task to test with")

# ==================== TEST 15: Update task ====================
print("\n[TEST 15] PUT /tasks/{task_id}")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}", {
        "description": "Updated: Create mockups and prototypes"
    }, token=token1)
    if r and r.status_code == 200:
        task = r.json()
        log_test("Update task description", 
                 task.get("description") == "Updated: Create mockups and prototypes")
    else:
        log_test("Update task description", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Update task description", False, "No task to test with")

# ==================== TEST 16: Move task status to done ====================
print("\n[TEST 16] PUT /tasks/{task_id}/status (to done)")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/status", {
        "status": "done"
    }, token=token1)
    if r and r.status_code == 200:
        task = r.json()
        passed = (task.get("status") == "done" and 
                  task.get("completed_at") is not None)
        log_test("Move task to done sets completed_at", passed)
    else:
        log_test("Move task to done sets completed_at", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Move task to done sets completed_at", False, "No task to test with")

# ==================== TEST 17: Move task status back to todo ====================
print("\n[TEST 17] PUT /tasks/{task_id}/status (back to todo)")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/status", {
        "status": "todo"
    }, token=token1)
    if r and r.status_code == 200:
        task = r.json()
        passed = (task.get("status") == "todo" and 
                  task.get("completed_at") is None)
        log_test("Move task back to todo clears completed_at", passed)
    else:
        log_test("Move task back to todo clears completed_at", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Move task back to todo clears completed_at", False, "No task to test with")

# ==================== TEST 18: Move task with invalid status ====================
print("\n[TEST 18] PUT /tasks/{task_id}/status (invalid)")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/status", {
        "status": "bad_status"
    }, token=token1)
    log_test("Move task with invalid status returns 400", 
             r and r.status_code == 400,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Move task with invalid status returns 400", False, "No task to test with")

# ==================== TEST 19: Toggle checklist item ====================
print("\n[TEST 19] PUT /tasks/{task_id}/checklist")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/checklist", {
        "index": 0,
        "done": True
    }, token=token1)
    if r and r.status_code == 200:
        task = r.json()
        checklist = task.get("checklist", [])
        passed = len(checklist) > 0 and checklist[0].get("done") == True
        log_test("Toggle checklist item to done", passed)
    else:
        log_test("Toggle checklist item to done", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Toggle checklist item to done", False, "No task to test with")

# ==================== TEST 20: Toggle checklist with invalid index ====================
print("\n[TEST 20] PUT /tasks/{task_id}/checklist (invalid index)")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/checklist", {
        "index": 99,
        "done": True
    }, token=token1)
    log_test("Toggle checklist with invalid index returns 400", 
             r and r.status_code == 400,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Toggle checklist with invalid index returns 400", False, "No task to test with")

# ==================== TEST 21: Create more tasks for filtering ====================
print("\n[TEST 21] Create additional tasks for filtering")
if board1_id:
    # Task 2: in_progress, medium priority
    r = req("POST", "/tasks", {
        "board_id": board1_id,
        "title": "Write blog post",
        "status": "in_progress",
        "priority": "medium"
    }, token=token1)
    task2_created = r and r.status_code == 200
    
    # Task 3: review, high priority
    r = req("POST", "/tasks", {
        "board_id": board1_id,
        "title": "Review client proposal",
        "status": "review",
        "priority": "high"
    }, token=token1)
    task3_created = r and r.status_code == 200
    
    log_test("Create additional tasks for filtering", 
             task2_created and task3_created)
else:
    log_test("Create additional tasks for filtering", False, "No board to test with")

# ==================== TEST 22: Filter by status ====================
print("\n[TEST 22] GET /tasks?board_id={id}&status=todo")
if board1_id:
    r = req("GET", "/tasks", token=token1, params={"board_id": board1_id, "status": "todo"})
    if r and r.status_code == 200:
        tasks = r.json()
        all_todo = all(t.get("status") == "todo" for t in tasks)
        log_test("Filter tasks by status=todo", all_todo, f"Got {len(tasks)} tasks")
    else:
        log_test("Filter tasks by status=todo", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Filter tasks by status=todo", False, "No board to test with")

# ==================== TEST 23: Filter by priority ====================
print("\n[TEST 23] GET /tasks?board_id={id}&priority=high")
if board1_id:
    r = req("GET", "/tasks", token=token1, params={"board_id": board1_id, "priority": "high"})
    if r and r.status_code == 200:
        tasks = r.json()
        all_high = all(t.get("priority") == "high" for t in tasks)
        log_test("Filter tasks by priority=high", all_high, f"Got {len(tasks)} tasks")
    else:
        log_test("Filter tasks by priority=high", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Filter tasks by priority=high", False, "No board to test with")

# ==================== TEST 24: Search tasks ====================
print("\n[TEST 24] GET /tasks?q=landing")
r = req("GET", "/tasks", token=token1, params={"q": "landing"})
if r and r.status_code == 200:
    tasks = r.json()
    found = any("landing" in t.get("title", "").lower() or 
                "landing" in t.get("description", "").lower() for t in tasks)
    log_test("Search tasks by query", found, f"Got {len(tasks)} tasks")
else:
    log_test("Search tasks by query", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 25: My tasks ====================
print("\n[TEST 25] GET /tasks/my")
r = req("GET", "/tasks/my", token=token1)
if r and r.status_code == 200:
    tasks = r.json()
    log_test("Get my tasks", len(tasks) >= 1, f"Got {len(tasks)} tasks")
else:
    log_test("Get my tasks", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 26: Kanban view ====================
print("\n[TEST 26] GET /tasks/board/{board_id}/kanban")
if board1_id:
    r = req("GET", f"/tasks/board/{board1_id}/kanban", token=token1)
    if r and r.status_code == 200:
        data = r.json()
        board = data.get("board")
        columns = data.get("columns", {})
        expected_columns = ["todo", "in_progress", "review", "blocked", "done"]
        has_all_columns = all(col in columns for col in expected_columns)
        has_structure = all(
            "key" in columns[col] and "name" in columns[col] and 
            "color" in columns[col] and "tasks" in columns[col] and 
            "count" in columns[col]
            for col in expected_columns if col in columns
        )
        log_test("Kanban view returns all columns with structure", 
                 has_all_columns and has_structure)
    else:
        log_test("Kanban view returns all columns with structure", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Kanban view returns all columns with structure", False, "No board to test with")

# ==================== TEST 27: Stats ====================
print("\n[TEST 27] GET /tasks/stats")
r = req("GET", "/tasks/stats", token=token1)
if r and r.status_code == 200:
    stats = r.json()
    required_fields = ["total", "active", "done", "overdue", "due_today", 
                       "done_this_week", "by_status", "by_priority"]
    has_all_fields = all(field in stats for field in required_fields)
    has_5_statuses = len(stats.get("by_status", [])) == 5
    has_4_priorities = len(stats.get("by_priority", [])) == 4
    log_test("Stats returns all KPIs and breakdowns", 
             has_all_fields and has_5_statuses and has_4_priorities)
else:
    log_test("Stats returns all KPIs and breakdowns", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 28: User isolation - User 2 sees empty boards ====================
print("\n[TEST 28] User 2 GET /tasks/boards (should be empty)")
r = req("GET", "/tasks/boards", token=token2)
if r and r.status_code == 200:
    boards = r.json()
    log_test("User 2 sees empty boards list", len(boards) == 0, 
             f"Got {len(boards)} boards")
else:
    log_test("User 2 sees empty boards list", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 29: User isolation - User 2 cannot access User 1's board ====================
print("\n[TEST 29] User 2 GET /tasks/boards/{user1_board_id}")
if board1_id:
    r = req("GET", f"/tasks/boards/{board1_id}", token=token2)
    log_test("User 2 cannot access User 1's board", 
             r and r.status_code == 404,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("User 2 cannot access User 1's board", False, "No board to test with")

# ==================== TEST 30: User isolation - User 2 cannot update User 1's task ====================
print("\n[TEST 30] User 2 PUT /tasks/{user1_task_id}/status")
if task1_id:
    r = req("PUT", f"/tasks/{task1_id}/status", {
        "status": "done"
    }, token=token2)
    log_test("User 2 cannot update User 1's task", 
             r and r.status_code == 404,
             f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("User 2 cannot update User 1's task", False, "No task to test with")

# ==================== TEST 31: Team board sharing ====================
print("\n[TEST 31] Team board sharing - User 2 joins team")
if team1_id and team_board_id:
    # User 2 joins User 1's team
    r = req("POST", f"/teams/{team1_id}/join", token=token2)
    if r and r.status_code == 200:
        print("   User 2 joined team")
        
        # User 2 should now see the team board
        r = req("GET", "/tasks/boards", token=token2)
        if r and r.status_code == 200:
            boards = r.json()
            team_board_visible = any(b.get("id") == team_board_id for b in boards)
            log_test("User 2 sees team board after joining", team_board_visible, 
                     f"Got {len(boards)} boards")
        else:
            log_test("User 2 sees team board after joining", False, 
                     f"Status: {r.status_code if r else 'No response'}")
    else:
        log_test("User 2 sees team board after joining", False, "Failed to join team")
else:
    log_test("User 2 sees team board after joining", False, "No team/board to test with")

# ==================== TEST 32: Route order - /tasks/ping ====================
print("\n[TEST 32] GET /tasks/ping (specific route)")
r = req("GET", "/tasks/ping", token=token1)
if r and r.status_code == 200:
    data = r.json()
    passed = (data.get("engine") == "tasks" and 
              data.get("status") == "active" and
              data.get("version") == "v1")
    log_test("Route /tasks/ping returns correct response", passed)
else:
    log_test("Route /tasks/ping returns correct response", False, 
             f"Status: {r.status_code if r else 'No response'}")

# ==================== TEST 33: Cascade delete ====================
print("\n[TEST 33] DELETE /tasks/boards/{board_id} (cascade)")
if board1_id:
    # First verify tasks exist
    r = req("GET", "/tasks", token=token1, params={"board_id": board1_id})
    tasks_before = len(r.json()) if r and r.status_code == 200 else 0
    print(f"   Tasks before delete: {tasks_before}")
    
    # Delete board
    r = req("DELETE", f"/tasks/boards/{board1_id}", token=token1)
    if r and r.status_code == 200:
        # Verify board is gone
        r = req("GET", f"/tasks/boards/{board1_id}", token=token1)
        board_gone = r and r.status_code == 404
        
        # Verify tasks are gone (try to get one)
        if task1_id:
            r = req("GET", f"/tasks/{task1_id}", token=token1)
            task_gone = r and r.status_code == 404
        else:
            task_gone = True
        
        log_test("Delete board cascades to tasks", board_gone and task_gone)
    else:
        log_test("Delete board cascades to tasks", False, 
                 f"Status: {r.status_code if r else 'No response'}")
else:
    log_test("Delete board cascades to tasks", False, "No board to test with")

# ==================== SUMMARY ====================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed_count = sum(1 for r in results if r["passed"])
failed_count = len(results) - passed_count

print(f"\nTotal: {len(results)} tests")
print(f"✅ Passed: {passed_count}")
print(f"❌ Failed: {failed_count}")

if failed_count > 0:
    print("\nFailed tests:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['test']}")
            if r["details"]:
                print(f"     {r['details']}")

# Save report
report = {
    "iteration": 11,
    "engine": "tasks",
    "timestamp": datetime.now().isoformat(),
    "summary": {
        "total": len(results),
        "passed": passed_count,
        "failed": failed_count
    },
    "tests": results
}

os.makedirs("/app/test_reports", exist_ok=True)
try:
    with open("/app/test_reports/iteration_11.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n✅ Report saved to /app/test_reports/iteration_11.json")
except TypeError as e:
    print(f"\n⚠️  Error saving JSON report: {e}")
    # Save as text instead
    with open("/app/test_reports/iteration_11.txt", "w") as f:
        f.write(f"Iteration 11 Test Report\n")
        f.write(f"Total: {len(results)}, Passed: {passed_count}, Failed: {failed_count}\n\n")
        for r in results:
            f.write(f"{'PASS' if r['passed'] else 'FAIL'}: {r['test']}\n")
            if r['details']:
                f.write(f"  Details: {r['details']}\n")
    print(f"✅ Report saved as text to /app/test_reports/iteration_11.txt")
print("=" * 80)
