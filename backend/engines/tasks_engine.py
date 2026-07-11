"""
Tasks Engine — Boards + Tasks Kanban + Checklists + Team Collaboration.
User-scoped for personal boards. Team-shared via team_id.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from core.deps import (
    db, now_iso, current_user, create_notification,
    TASK_STATUSES, TASK_STATUS_KEYS,
    TASK_PRIORITIES, TASK_PRIORITY_KEYS,
)
from core.schemas import (
    BoardCreate, BoardUpdate, TaskCreate, TaskUpdate,
    TaskStatusMove, ChecklistToggle,
)

router = APIRouter(tags=["tasks"])


# ═══════════════════════════════════════════════════════════════
# META
# ═══════════════════════════════════════════════════════════════
@router.get("/tasks/meta")
async def tasks_meta():
    return {"statuses": TASK_STATUSES, "priorities": TASK_PRIORITIES}


# ═══════════════════════════════════════════════════════════════
# ACCESS HELPERS
# ═══════════════════════════════════════════════════════════════
async def _user_can_access_board(user_id: str, board: dict) -> bool:
    """User can access board if owner OR (team board and user is member of the team)."""
    if not board:
        return False
    if board.get("owner_id") == user_id:
        return True
    if board.get("kind") == "team" and board.get("team_id"):
        member = await db.team_members.find_one({"team_id": board["team_id"], "user_id": user_id})
        return bool(member)
    return False


async def _get_accessible_board(user_id: str, board_id: str) -> dict:
    b = await db.task_boards.find_one({"id": board_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "اللوحة غير موجودة")
    if not await _user_can_access_board(user_id, b):
        raise HTTPException(404, "اللوحة غير موجودة")
    return b


# ═══════════════════════════════════════════════════════════════
# BOARDS CRUD
# ═══════════════════════════════════════════════════════════════
async def _enrich_board(b: dict, user_id: str) -> dict:
    b.pop("_id", None)
    b["tasks_count"] = await db.tasks.count_documents({"board_id": b["id"]})
    b["done_count"] = await db.tasks.count_documents({"board_id": b["id"], "status": "done"})
    if b.get("team_id"):
        t = await db.teams.find_one({"id": b["team_id"]}, {"_id": 0, "name": 1})
        b["team"] = t
    return b


@router.get("/tasks/boards")
async def list_boards(user=Depends(current_user)):
    # personal boards owned by user
    owned = await db.task_boards.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # team boards where user is a member
    member_teams = await db.team_members.find({"user_id": user["id"]}, {"_id": 0, "team_id": 1}).to_list(200)
    team_ids = [m["team_id"] for m in member_teams]
    shared = []
    if team_ids:
        shared = await db.task_boards.find(
            {"kind": "team", "team_id": {"$in": team_ids}, "owner_id": {"$ne": user["id"]}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(200)
    all_boards = owned + shared
    return [await _enrich_board(b, user["id"]) for b in all_boards]


@router.post("/tasks/boards")
async def create_board(data: BoardCreate, user=Depends(current_user)):
    if data.kind == "team":
        if not data.team_id:
            raise HTTPException(400, "team_id مطلوب للوحة الفريق")
        # verify user is member of that team
        member = await db.team_members.find_one({"team_id": data.team_id, "user_id": user["id"]})
        if not member:
            raise HTTPException(403, "لست عضواً في هذا الفريق")
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "name": data.name.strip(),
        "description": data.description or "",
        "color": data.color or "#E3FF00",
        "kind": data.kind or "personal",
        "team_id": data.team_id if data.kind == "team" else None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.task_boards.insert_one(doc)
    return await _enrich_board(dict(doc), user["id"])


@router.get("/tasks/boards/{board_id}")
async def get_board(board_id: str, user=Depends(current_user)):
    b = await _get_accessible_board(user["id"], board_id)
    return await _enrich_board(b, user["id"])


@router.put("/tasks/boards/{board_id}")
async def update_board(board_id: str, data: BoardUpdate, user=Depends(current_user)):
    b = await db.task_boards.find_one({"id": board_id, "owner_id": user["id"]})
    if not b:
        raise HTTPException(404, "اللوحة غير موجودة")
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    update["updated_at"] = now_iso()
    await db.task_boards.update_one({"id": board_id, "owner_id": user["id"]}, {"$set": update})
    doc = await db.task_boards.find_one({"id": board_id}, {"_id": 0})
    return await _enrich_board(doc, user["id"])


@router.delete("/tasks/boards/{board_id}")
async def delete_board(board_id: str, user=Depends(current_user)):
    b = await db.task_boards.find_one({"id": board_id, "owner_id": user["id"]})
    if not b:
        raise HTTPException(404, "اللوحة غير موجودة")
    await db.tasks.delete_many({"board_id": board_id})
    await db.task_boards.delete_one({"id": board_id, "owner_id": user["id"]})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# TASKS CRUD
# ═══════════════════════════════════════════════════════════════
async def _enrich_task(t: dict, user_id: str) -> dict:
    t.pop("_id", None)
    if t.get("assignee_id"):
        u = await db.users.find_one({"id": t["assignee_id"]}, {"_id": 0, "password": 0})
        t["assignee"] = u
    return t


@router.get("/tasks")
async def list_tasks(
    user=Depends(current_user),
    board_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
):
    if board_id:
        # verify access
        b = await _get_accessible_board(user["id"], board_id)
        query = {"board_id": board_id}
    else:
        # get all boards user can access
        member_teams = await db.team_members.find({"user_id": user["id"]}, {"_id": 0, "team_id": 1}).to_list(200)
        team_ids = [m["team_id"] for m in member_teams]
        accessible = await db.task_boards.find(
            {"$or": [
                {"owner_id": user["id"]},
                {"kind": "team", "team_id": {"$in": team_ids}},
            ]}, {"_id": 0, "id": 1}
        ).to_list(500)
        board_ids = [b["id"] for b in accessible]
        query = {"board_id": {"$in": board_ids}}

    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if assignee_id:
        query["assignee_id"] = assignee_id
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    tasks = await db.tasks.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return [await _enrich_task(t, user["id"]) for t in tasks]


@router.post("/tasks")
async def create_task(data: TaskCreate, user=Depends(current_user)):
    # verify board access
    b = await _get_accessible_board(user["id"], data.board_id)
    status = data.status or "todo"
    if status not in TASK_STATUS_KEYS:
        raise HTTPException(400, "حالة غير صحيحة")
    priority = data.priority or "medium"
    if priority not in TASK_PRIORITY_KEYS:
        raise HTTPException(400, "أولوية غير صحيحة")
    # validate assignee (if team board, must be team member; else can be self)
    if data.assignee_id:
        if b.get("kind") == "team":
            member = await db.team_members.find_one({"team_id": b["team_id"], "user_id": data.assignee_id})
            if not member:
                raise HTTPException(400, "المُسنَد إليه ليس عضواً في الفريق")
        # for personal, allow any user (or restrict to self? — allow any for flexibility)
    doc = {
        "id": str(uuid.uuid4()),
        "board_id": data.board_id,
        "owner_id": user["id"],  # creator
        "title": data.title.strip(),
        "description": data.description or "",
        "status": status,
        "priority": priority,
        "assignee_id": data.assignee_id,
        "due_date": data.due_date,
        "tags": data.tags or [],
        "checklist": data.checklist or [],
        "client_id": data.client_id,
        "deal_id": data.deal_id,
        "content_item_id": data.content_item_id,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "completed_at": now_iso() if status == "done" else None,
    }
    await db.tasks.insert_one(doc)
    # notify assignee if different from creator
    if data.assignee_id and data.assignee_id != user["id"]:
        await create_notification(
            data.assignee_id, "task_assigned",
            f"@{user['username']} أسند إليك مهمة: {doc['title']}",
            doc["id"], user["id"],
        )
    return await _enrich_task(dict(doc), user["id"])


@router.get("/tasks/my")
async def my_tasks(user=Depends(current_user)):
    """All tasks assigned to me or created by me."""
    tasks = await db.tasks.find(
        {"$or": [{"assignee_id": user["id"]}, {"owner_id": user["id"]}]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(500)
    return [await _enrich_task(t, user["id"]) for t in tasks]


# ═══════════════════════════════════════════════════════════════
# KANBAN VIEW (declared BEFORE /tasks/{task_id} to avoid route conflict)
# ═══════════════════════════════════════════════════════════════
@router.get("/tasks/board/{board_id}/kanban")
async def board_kanban(board_id: str, user=Depends(current_user)):
    b = await _get_accessible_board(user["id"], board_id)
    result = {"board": await _enrich_board(dict(b), user["id"]), "columns": {}}
    for status in TASK_STATUSES:
        tasks = await db.tasks.find(
            {"board_id": board_id, "status": status["key"]}, {"_id": 0}
        ).sort("updated_at", -1).to_list(500)
        enriched = [await _enrich_task(t, user["id"]) for t in tasks]
        result["columns"][status["key"]] = {**status, "tasks": enriched, "count": len(enriched)}
    return result


# ═══════════════════════════════════════════════════════════════
# STATS (declared BEFORE /tasks/{task_id})
# ═══════════════════════════════════════════════════════════════
@router.get("/tasks/stats")
async def tasks_stats(user=Depends(current_user)):
    """Stats over all tasks user has access to (owned + assigned)."""
    my_tasks_list = await db.tasks.find(
        {"$or": [{"assignee_id": user["id"]}, {"owner_id": user["id"]}]},
        {"_id": 0}
    ).to_list(5000)

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now.date() - timedelta(days=now.weekday() + 2)).isoformat()

    active = [t for t in my_tasks_list if t.get("status") != "done"]
    done = [t for t in my_tasks_list if t.get("status") == "done"]
    overdue = [
        t for t in active
        if t.get("due_date") and t["due_date"][:10] < today
    ]
    due_today = [
        t for t in active
        if t.get("due_date") and t["due_date"][:10] == today
    ]
    done_this_week = [
        t for t in done
        if t.get("completed_at") and t["completed_at"][:10] >= week_start
    ]

    by_status = []
    for s in TASK_STATUSES:
        by_status.append({**s, "count": len([t for t in my_tasks_list if t.get("status") == s["key"]])})
    by_priority = []
    for p in TASK_PRIORITIES:
        by_priority.append({**p, "count": len([t for t in my_tasks_list if t.get("priority") == p["key"]])})

    return {
        "total": len(my_tasks_list),
        "active": len(active),
        "done": len(done),
        "overdue": len(overdue),
        "due_today": len(due_today),
        "done_this_week": len(done_this_week),
        "by_status": by_status,
        "by_priority": by_priority,
    }


# Backwards compat ping (declared BEFORE /tasks/{task_id})
@router.get("/tasks/ping")
async def tasks_ping():
    return {"engine": "tasks", "status": "active", "version": "v1"}


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, user=Depends(current_user)):
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "المهمة غير موجودة")
    b = await db.task_boards.find_one({"id": t["board_id"]})
    if not await _user_can_access_board(user["id"], b):
        raise HTTPException(404, "المهمة غير موجودة")
    return await _enrich_task(t, user["id"])


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user=Depends(current_user)):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "المهمة غير موجودة")
    b = await db.task_boards.find_one({"id": t["board_id"]})
    if not await _user_can_access_board(user["id"], b):
        raise HTTPException(404, "المهمة غير موجودة")
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "priority" in update and update["priority"] not in TASK_PRIORITY_KEYS:
        raise HTTPException(400, "أولوية غير صحيحة")
    update["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": update})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await _enrich_task(doc, user["id"])


@router.put("/tasks/{task_id}/status")
async def move_status(task_id: str, data: TaskStatusMove, user=Depends(current_user)):
    if data.status not in TASK_STATUS_KEYS:
        raise HTTPException(400, "حالة غير صحيحة")
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "المهمة غير موجودة")
    b = await db.task_boards.find_one({"id": t["board_id"]})
    if not await _user_can_access_board(user["id"], b):
        raise HTTPException(404, "المهمة غير موجودة")
    update = {"status": data.status, "updated_at": now_iso()}
    if data.status == "done":
        update["completed_at"] = now_iso()
    elif t.get("completed_at") and data.status != "done":
        update["completed_at"] = None
    await db.tasks.update_one({"id": task_id}, {"$set": update})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await _enrich_task(doc, user["id"])


@router.put("/tasks/{task_id}/checklist")
async def toggle_checklist(task_id: str, data: ChecklistToggle, user=Depends(current_user)):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "المهمة غير موجودة")
    b = await db.task_boards.find_one({"id": t["board_id"]})
    if not await _user_can_access_board(user["id"], b):
        raise HTTPException(404, "المهمة غير موجودة")
    checklist = t.get("checklist") or []
    if data.index < 0 or data.index >= len(checklist):
        raise HTTPException(400, "index خارج النطاق")
    checklist[data.index]["done"] = bool(data.done)
    await db.tasks.update_one({"id": task_id}, {"$set": {"checklist": checklist, "updated_at": now_iso()}})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await _enrich_task(doc, user["id"])


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(current_user)):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(404, "المهمة غير موجودة")
    b = await db.task_boards.find_one({"id": t["board_id"]})
    if not await _user_can_access_board(user["id"], b):
        raise HTTPException(404, "المهمة غير موجودة")
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# (Kanban + Stats + ping already declared above BEFORE /tasks/{task_id})
# ═══════════════════════════════════════════════════════════════
