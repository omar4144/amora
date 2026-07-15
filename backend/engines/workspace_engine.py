"""
Workspace Engine — Unified cross-engine hub.
Consolidates data from CRM + Content + Tasks into a single "today" view.
"""
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.deps import db, current_user, now_iso, EMERGENT_LLM_KEY, AI_PROMPTS

router = APIRouter(tags=["workspace"])
logger = logging.getLogger("ruaa.workspace")


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



# ==================== MORNING BRIEF (AI-powered daily kickoff) ====================
def _compact_task(t: dict) -> dict:
    return {"id": t.get("id"), "title": t.get("title"), "due_date": t.get("due_date"), "priority": t.get("priority")}


def _compact_content(c: dict) -> dict:
    return {"id": c.get("id"), "title": c.get("title"), "platform": c.get("platform"), "scheduled_at": c.get("scheduled_at")}


def _compact_deal(d: dict) -> dict:
    return {"id": d.get("id"), "title": d.get("title"), "value": d.get("value"), "stage": d.get("stage"), "client": (d.get("client") or {}).get("name") if isinstance(d.get("client"), dict) else None}


async def _gather_context(uid: str) -> dict:
    """Reuses the same today-focus logic, returns compact JSON-safe dict."""
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    next_week = (now + timedelta(days=7)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    member_teams = await db.team_members.find({"user_id": uid}, {"_id": 0, "team_id": 1}).to_list(200)
    team_ids = [m["team_id"] for m in member_teams]
    accessible_boards = await db.task_boards.find(
        {"$or": [{"owner_id": uid}, {"kind": "team", "team_id": {"$in": team_ids}}]},
        {"_id": 0, "id": 1}
    ).to_list(500)
    board_ids = [b["id"] for b in accessible_boards]

    overdue = await db.tasks.find({
        "board_id": {"$in": board_ids},
        "status": {"$nin": ["done"]},
        "due_date": {"$lt": today_str + "T00:00:00", "$ne": None},
        "$or": [{"assignee_id": uid}, {"owner_id": uid}],
    }, {"_id": 0}).sort("due_date", 1).to_list(10)

    due_today = await db.tasks.find({
        "board_id": {"$in": board_ids},
        "status": {"$nin": ["done"]},
        "due_date": {"$regex": f"^{today_str}"},
        "$or": [{"assignee_id": uid}, {"owner_id": uid}],
    }, {"_id": 0}).to_list(10)

    upcoming = await db.content_items.find({
        "owner_id": uid,
        "status": {"$in": ["scheduled", "approved"]},
        "scheduled_at": {"$gte": now.isoformat(), "$lte": next_week},
    }, {"_id": 0}).sort("scheduled_at", 1).to_list(10)

    stale = await db.crm_deals.find({
        "owner_id": uid,
        "stage": {"$nin": ["won", "lost"]},
        "updated_at": {"$lt": week_ago},
    }, {"_id": 0}).sort("value", -1).to_list(10)
    for d in stale:
        if d.get("client_id"):
            cli = await db.crm_clients.find_one({"id": d["client_id"], "owner_id": uid}, {"_id": 0, "name": 1})
            d["client"] = cli

    return {
        "date": today_str,
        "overdue_tasks": [_compact_task(t) for t in overdue],
        "due_today_tasks": [_compact_task(t) for t in due_today],
        "upcoming_content": [_compact_content(c) for c in upcoming],
        "stale_deals": [_compact_deal(d) for d in stale],
    }


def _parse_ai_json(text: str) -> Optional[dict]:
    """Robust JSON parse — strip code fences if any."""
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        # remove fence lines
        lines = [ln for ln in t.splitlines() if not ln.strip().startswith("```")]
        t = "\n".join(lines).strip()
    try:
        obj = json.loads(t)
        if isinstance(obj, dict) and "summary" in obj and "focus" in obj:
            return obj
    except Exception:
        pass
    # last-chance: extract {...}
    try:
        start = t.find("{")
        end = t.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(t[start:end + 1])
    except Exception:
        return None
    return None


@router.post("/workspace/morning-brief")
async def morning_brief(force: bool = Query(False), user=Depends(current_user)):
    """AI-powered daily kickoff for the workspace. Cached once per user per day."""
    uid = user["id"]
    today_str = datetime.now(timezone.utc).date().isoformat()

    if not force:
        cached = await db.workspace_briefs.find_one({"user_id": uid, "date": today_str}, {"_id": 0})
        if cached:
            return {**cached, "from_cache": True}

    ctx = await _gather_context(uid)

    system_prompt = AI_PROMPTS.get("morning_brief")
    payload = {
        "user_name": user.get("name", ""),
        "overdue_tasks_count": len(ctx["overdue_tasks"]),
        "due_today_count": len(ctx["due_today_tasks"]),
        "upcoming_content_count": len(ctx["upcoming_content"]),
        "stale_deals_count": len(ctx["stale_deals"]),
        "data": ctx,
    }

    summary = ""
    focus = []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{uid}-morning-{today_str}",
            system_message=system_prompt,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=json.dumps(payload, ensure_ascii=False))
        reply = await chat.send_message(msg)
        parsed = _parse_ai_json(reply)
        if parsed:
            summary = parsed.get("summary", "") or ""
            focus = parsed.get("focus", []) or []
    except Exception as e:
        logger.error(f"morning-brief AI error: {e}")

    # Deterministic fallback if AI fails or empty
    if not summary:
        total_pending = payload["overdue_tasks_count"] + payload["due_today_count"]
        if total_pending == 0 and payload["upcoming_content_count"] == 0 and payload["stale_deals_count"] == 0:
            summary = f"صباح جميل يا {user.get('name', '')}. يومك خالٍ من التنبيهات — فرصة ذهبية لبناء عميل جديد أو فكرة محتوى."
        else:
            summary = f"صباح الخير {user.get('name', '')}. اليوم لديك {payload['overdue_tasks_count']} مهمة متأخرة و{payload['due_today_count']} مستحقة اليوم، و{payload['upcoming_content_count']} محتوى قادم."
    if not focus:
        focus = []
        if ctx["overdue_tasks"]:
            t = ctx["overdue_tasks"][0]
            focus.append({"title": f"أغلق المهمة المتأخرة: {t['title']}", "why": "تجنب تراكم المتأخرات", "engine": "tasks", "ref_id": t["id"]})
        if ctx["stale_deals"]:
            d = ctx["stale_deals"][0]
            focus.append({"title": f"تابع صفقة: {d['title']}", "why": f"لم يتم تحديثها منذ أسبوع — بقيمة ${d.get('value') or 0}", "engine": "crm", "ref_id": d["id"]})
        if ctx["upcoming_content"]:
            c = ctx["upcoming_content"][0]
            focus.append({"title": f"جهّز محتوى: {c['title']}", "why": f"مجدول قريباً على {c.get('platform')}", "engine": "content", "ref_id": c["id"]})
        if not focus:
            focus = [
                {"title": "أضف أول عميل في CRM", "why": "أسس قاعدة عملائك", "engine": "crm", "ref_id": ""},
                {"title": "أنشئ لوحة مهام جديدة", "why": "نظّم يومك", "engine": "tasks", "ref_id": ""},
                {"title": "ولّد أفكار محتوى بالذكاء", "why": "ابدأ خطتك للأسبوع", "engine": "content", "ref_id": ""},
            ]

    brief = {
        "user_id": uid,
        "date": today_str,
        "summary": summary,
        "focus": focus[:3],
        "created_at": now_iso(),
    }
    await db.workspace_briefs.update_one(
        {"user_id": uid, "date": today_str},
        {"$set": brief},
        upsert=True,
    )
    return {**brief, "from_cache": False}


# ==================== WEEKLY RECOMMENDATIONS ====================
@router.post("/workspace/recommendations")
async def weekly_recommendations(force: bool = Query(False), user=Depends(current_user)):
    """AI-generated personalized growth tips based on onboarding data + usage stats. Cached weekly."""
    uid = user["id"]
    now = datetime.now(timezone.utc)
    week_key = now.strftime("%Y-W%V")

    if not force:
        cached = await db.workspace_recos.find_one({"user_id": uid, "week": week_key}, {"_id": 0})
        if cached:
            return {**cached, "from_cache": True}

    # gather usage stats (guard services collection which may not exist yet)
    try:
        services_count = await db.services.count_documents({"seller_id": uid})
    except Exception:
        services_count = 0
    stats = {
        "clients": await db.crm_clients.count_documents({"owner_id": uid}),
        "deals": await db.crm_deals.count_documents({"owner_id": uid}),
        "won_deals": await db.crm_deals.count_documents({"owner_id": uid, "stage": "won"}),
        "invoices": await db.invoices.count_documents({"owner_id": uid}),
        "content_items": await db.content_items.count_documents({"owner_id": uid}),
        "published_content": await db.content_items.count_documents({"owner_id": uid, "status": "published"}),
        "tasks": await db.tasks.count_documents({"owner_id": uid}),
        "communities_joined": await db.community_members.count_documents({"user_id": uid}),
        "services_offered": services_count,
    }

    payload = {
        "primary_goal": user.get("primary_goal") or "all",
        "interests": user.get("interests") or [],
        "experience_level": user.get("experience_level") or "intermediate",
        "user_name": user.get("name", ""),
        "stats": stats,
    }

    recos = []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{uid}-reco-{week_key}",
            system_message=AI_PROMPTS["recommendations"],
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=json.dumps(payload, ensure_ascii=False))
        reply = await chat.send_message(msg)
        parsed = _parse_ai_json(reply)
        if parsed and isinstance(parsed.get("recommendations"), list):
            recos = parsed["recommendations"][:3]
    except Exception as e:
        logger.error(f"recommendations AI error: {e}")

    # Deterministic fallback tuned to primary_goal + stats
    if not recos:
        goal = payload["primary_goal"]
        interests = payload["interests"]
        recos = []
        if goal == "crm" and stats["clients"] == 0:
            recos.append({"title": "أضف أول عميل في CRM", "why": "أنت اخترت CRM كهدف — نبدأ ببناء قاعدة عملائك", "action_label": "أضف عميل", "engine": "crm", "priority": "high"})
        if goal == "content" and stats["content_items"] == 0:
            recos.append({"title": "ولّد أفكار محتوى بالذكاء", "why": "استغل مساعد Claude لتخطيط أسبوعك الإبداعي", "action_label": "ابدأ", "engine": "content", "priority": "high"})
        if goal == "tasks" and stats["tasks"] == 0:
            recos.append({"title": "أنشئ لوحة كانبان الأولى", "why": "نظّم يومك ومهامك في مكان واحد", "action_label": "أنشئ لوحة", "engine": "tasks", "priority": "high"})
        if "marketplace" in interests and stats["services_offered"] == 0:
            recos.append({"title": "أضف أول خدمة للبيع", "why": "اهتمامك بالسوق يستحق البدء", "action_label": "أضف خدمة", "engine": "marketplace", "priority": "medium"})
        if "community" in interests and stats["communities_joined"] < 2:
            recos.append({"title": "انضم لمجتمعين على الأقل", "why": "المجتمعات مصدر إلهام وشراكات", "action_label": "استعرض", "engine": "community", "priority": "medium"})
        if not recos:
            recos = [
                {"title": "اكتب سيرتك الذاتية بالذكاء", "why": "افتح فرص التواصل بملف احترافي", "action_label": "حسّن Bio", "engine": "social", "priority": "medium"},
                {"title": "استكشف السوق", "why": "ابحث عن فرص جديدة", "action_label": "اذهب", "engine": "marketplace", "priority": "low"},
                {"title": "انضم لمجتمعك المفضّل", "why": "ابنِ شبكة علاقات نوعية", "action_label": "استعرض", "engine": "community", "priority": "low"},
            ]
        recos = recos[:3]

    doc = {
        "user_id": uid,
        "week": week_key,
        "recommendations": recos,
        "generated_at": now_iso(),
    }
    await db.workspace_recos.update_one(
        {"user_id": uid, "week": week_key},
        {"$set": doc},
        upsert=True,
    )
    return {**doc, "from_cache": False}

