"""
Workspace Engine — Unified cross-engine hub.
Consolidates data from CRM + Content + Tasks into a single "today" view.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.deps import db, current_user

router = APIRouter(tags=["workspace"])


async def _enrich_task(t: dict) -> dict:
    t.pop("_id", None)
    if t.get("assignee_id"):
        u = await db.users.find_one({"id": t["assignee_id"]}, {"_id": 0, "password": 0})
        t["assignee"] = u
    if t.get("board_id"):
        b = await db.task_boards.find_one({"id": t["board_id"]}, {"_id": 0, "name": 1, "color": 1})
        t["board"] = b
    return t


async def _enrich_content(c: dict, owner_id: str) -> dict:
    c.pop("_id", None)
    if c.get("client_id"):
        client = await db.crm_clients.find_one({"id": c["client_id"], "owner_id": owner_id}, {"_id": 0, "name": 1, "company": 1})
        c["client"] = client
    return c


async def _enrich_deal(d: dict, owner_id: str) -> dict:
    d.pop("_id", None)
    if d.get("client_id"):
        client = await db.crm_clients.find_one({"id": d["client_id"], "owner_id": owner_id}, {"_id": 0, "name": 1, "company": 1})
        d["client"] = client
    return d


@router.get("/workspace/today")
async def workspace_today(user=Depends(current_user)):
    """One-shot unified snapshot for user's daily focus."""
    uid = user["id"]
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    next_week = (now + timedelta(days=7)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    # 1. Overdue tasks (any board user has access to)
    member_teams = await db.team_members.find({"user_id": uid}, {"_id": 0, "team_id": 1}).to_list(200)
    team_ids = [m["team_id"] for m in member_teams]
    accessible_boards = await db.task_boards.find(
        {"$or": [{"owner_id": uid}, {"kind": "team", "team_id": {"$in": team_ids}}]},
        {"_id": 0, "id": 1}
    ).to_list(500)
    board_ids = [b["id"] for b in accessible_boards]

    overdue_tasks = await db.tasks.find({
        "board_id": {"$in": board_ids},
        "status": {"$nin": ["done"]},
        "due_date": {"$lt": today_str + "T00:00:00", "$ne": None},
        "$or": [{"assignee_id": uid}, {"owner_id": uid}],
    }, {"_id": 0}).sort("due_date", 1).to_list(20)
    overdue_tasks = [await _enrich_task(t) for t in overdue_tasks]

    due_today_tasks = await db.tasks.find({
        "board_id": {"$in": board_ids},
        "status": {"$nin": ["done"]},
        "due_date": {"$regex": f"^{today_str}"},
        "$or": [{"assignee_id": uid}, {"owner_id": uid}],
    }, {"_id": 0}).to_list(20)
    due_today_tasks = [await _enrich_task(t) for t in due_today_tasks]

    # 2. Upcoming content (scheduled next 7 days)
    upcoming_content = await db.content_items.find({
        "owner_id": uid,
        "status": {"$in": ["scheduled", "approved"]},
        "scheduled_at": {"$gte": now.isoformat(), "$lte": next_week},
    }, {"_id": 0}).sort("scheduled_at", 1).to_list(10)
    upcoming_content = [await _enrich_content(c, uid) for c in upcoming_content]

    # 3. Deals to follow up: active deals with updated_at older than a week
    stale_deals = await db.crm_deals.find({
        "owner_id": uid,
        "stage": {"$nin": ["won", "lost"]},
        "updated_at": {"$lt": week_ago},
    }, {"_id": 0}).sort("value", -1).to_list(10)
    stale_deals = [await _enrich_deal(d, uid) for d in stale_deals]

    # 4. Quick stats
    quick_stats = {
        "clients": await db.crm_clients.count_documents({"owner_id": uid}),
        "active_deals": await db.crm_deals.count_documents({"owner_id": uid, "stage": {"$nin": ["won", "lost"]}}),
        "tasks_active": await db.tasks.count_documents({
            "board_id": {"$in": board_ids},
            "status": {"$nin": ["done"]},
            "$or": [{"assignee_id": uid}, {"owner_id": uid}],
        }),
        "content_pending": await db.content_items.count_documents({
            "owner_id": uid,
            "status": {"$in": ["idea", "draft", "review", "approved"]},
        }),
    }

    # 5. Recent activity across all engines (CRM activities + task/content events)
    activities = await db.crm_activities.find({"owner_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(15)
    for a in activities:
        a["_source"] = "crm"

    return {
        "overdue_tasks": overdue_tasks,
        "due_today_tasks": due_today_tasks,
        "upcoming_content": upcoming_content,
        "stale_deals": stale_deals,
        "quick_stats": quick_stats,
        "recent_activities": activities,
        "is_new_user": quick_stats["clients"] == 0 and quick_stats["tasks_active"] == 0 and quick_stats["content_pending"] == 0,
    }


@router.get("/workspace/related")
async def workspace_related(
    user=Depends(current_user),
    client_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    task_id: Optional[str] = None,
    content_id: Optional[str] = None,
):
    """Return items linked to a given entity across engines."""
    uid = user["id"]
    result = {"deals": [], "content": [], "tasks": [], "activities": []}

    if client_id:
        # verify ownership
        c = await db.crm_clients.find_one({"id": client_id, "owner_id": uid})
        if not c:
            return result
        deals = await db.crm_deals.find({"owner_id": uid, "client_id": client_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        content = await db.content_items.find({"owner_id": uid, "client_id": client_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        tasks = await db.tasks.find({"owner_id": uid, "client_id": client_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        activities = await db.crm_activities.find({"owner_id": uid, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
        for d in deals: d.pop("_id", None)
        for c in content: c.pop("_id", None)
        for t in tasks: t.pop("_id", None)
        for a in activities: a.pop("_id", None)
        result = {"deals": deals, "content": content, "tasks": tasks, "activities": activities}

    elif deal_id:
        d = await db.crm_deals.find_one({"id": deal_id, "owner_id": uid})
        if d:
            tasks = await db.tasks.find({"owner_id": uid, "deal_id": deal_id}, {"_id": 0}).to_list(50)
            content = await db.content_items.find({"owner_id": uid, "client_id": d.get("client_id")}, {"_id": 0}).limit(10).to_list(10)
            activities = await db.crm_activities.find({"owner_id": uid, "deal_id": deal_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
            for t in tasks: t.pop("_id", None)
            for c in content: c.pop("_id", None)
            for a in activities: a.pop("_id", None)
            result = {"deals": [], "content": content, "tasks": tasks, "activities": activities}

    elif content_id:
        item = await db.content_items.find_one({"id": content_id, "owner_id": uid})
        if item:
            tasks = await db.tasks.find({"owner_id": uid, "content_item_id": content_id}, {"_id": 0}).to_list(50)
            for t in tasks: t.pop("_id", None)
            result = {"deals": [], "content": [], "tasks": tasks, "activities": []}

    return result
