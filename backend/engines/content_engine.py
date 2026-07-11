"""
Content OS Engine — Content Calendar + Kanban + Idea Generation + Scriptwriting.
User-scoped. Multi-platform (Instagram, TikTok, X, LinkedIn, YouTube, Facebook, Snapchat).
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from core.deps import (
    db, now_iso, current_user,
    CONTENT_STATUSES, CONTENT_STATUS_KEYS,
    CONTENT_PLATFORMS, CONTENT_FORMATS, CONTENT_FORMAT_KEYS,
    EMERGENT_LLM_KEY, AI_PROMPTS,
)
from core.schemas import ContentCreate, ContentUpdate, ContentStatusMove, ContentAIRequest

router = APIRouter(tags=["content"])
logger = logging.getLogger("ruaa.content")

VALID_PLATFORMS = {p["key"] for p in CONTENT_PLATFORMS}


# ═══════════════════════════════════════════════════════════════
# META
# ═══════════════════════════════════════════════════════════════
@router.get("/content/meta")
async def content_meta():
    return {
        "statuses": CONTENT_STATUSES,
        "platforms": CONTENT_PLATFORMS,
        "formats": CONTENT_FORMATS,
    }


# ═══════════════════════════════════════════════════════════════
# ITEMS CRUD
# ═══════════════════════════════════════════════════════════════
async def _enrich_content(c: dict) -> dict:
    c.pop("_id", None)
    if c.get("client_id"):
        client = await db.crm_clients.find_one(
            {"id": c["client_id"], "owner_id": c["owner_id"]},
            {"_id": 0, "name": 1, "company": 1},
        )
        c["client"] = client
    return c


@router.get("/content/items")
async def list_items(
    user=Depends(current_user),
    status: Optional[str] = None,
    platform: Optional[str] = None,
    client_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
):
    query = {"owner_id": user["id"]}
    if status:
        query["status"] = status
    if platform:
        query["platform"] = platform
    if client_id:
        query["client_id"] = client_id
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"caption": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    items = await db.content_items.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return [await _enrich_content(x) for x in items]


@router.post("/content/items")
async def create_item(data: ContentCreate, user=Depends(current_user)):
    status = data.status or "idea"
    if status not in CONTENT_STATUS_KEYS:
        raise HTTPException(400, "حالة غير صحيحة")
    if data.platform not in VALID_PLATFORMS:
        raise HTTPException(400, "منصة غير صحيحة")
    if data.format not in CONTENT_FORMAT_KEYS:
        raise HTTPException(400, "صيغة غير صحيحة")
    if data.client_id:
        client = await db.crm_clients.find_one({"id": data.client_id, "owner_id": user["id"]})
        if not client:
            raise HTTPException(404, "العميل غير موجود")
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "title": data.title.strip(),
        "description": data.description or "",
        "platform": data.platform,
        "format": data.format,
        "status": status,
        "scheduled_at": data.scheduled_at,
        "published_at": now if status == "published" else None,
        "caption": data.caption or "",
        "hook": data.hook or "",
        "script": data.script or "",
        "hashtags": data.hashtags or "",
        "tags": data.tags or [],
        "client_id": data.client_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.content_items.insert_one(doc)
    return await _enrich_content(dict(doc))


@router.get("/content/items/{item_id}")
async def get_item(item_id: str, user=Depends(current_user)):
    c = await db.content_items.find_one({"id": item_id, "owner_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "المحتوى غير موجود")
    return await _enrich_content(c)


@router.put("/content/items/{item_id}")
async def update_item(item_id: str, data: ContentUpdate, user=Depends(current_user)):
    c = await db.content_items.find_one({"id": item_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "المحتوى غير موجود")
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "platform" in update and update["platform"] not in VALID_PLATFORMS:
        raise HTTPException(400, "منصة غير صحيحة")
    if "format" in update and update["format"] not in CONTENT_FORMAT_KEYS:
        raise HTTPException(400, "صيغة غير صحيحة")
    if update.get("client_id"):
        client = await db.crm_clients.find_one({"id": update["client_id"], "owner_id": user["id"]})
        if not client:
            raise HTTPException(404, "العميل غير موجود")
    update["updated_at"] = now_iso()
    await db.content_items.update_one({"id": item_id, "owner_id": user["id"]}, {"$set": update})
    doc = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    return await _enrich_content(doc)


@router.put("/content/items/{item_id}/status")
async def move_status(item_id: str, data: ContentStatusMove, user=Depends(current_user)):
    if data.status not in CONTENT_STATUS_KEYS:
        raise HTTPException(400, "حالة غير صحيحة")
    c = await db.content_items.find_one({"id": item_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "المحتوى غير موجود")
    update = {"status": data.status, "updated_at": now_iso()}
    if data.status == "published" and not c.get("published_at"):
        update["published_at"] = now_iso()
    elif data.status != "published" and c.get("published_at"):
        # if moved out of published, keep published_at for history
        pass
    await db.content_items.update_one({"id": item_id, "owner_id": user["id"]}, {"$set": update})
    doc = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    return await _enrich_content(doc)


@router.delete("/content/items/{item_id}")
async def delete_item(item_id: str, user=Depends(current_user)):
    c = await db.content_items.find_one({"id": item_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "المحتوى غير موجود")
    await db.content_items.delete_one({"id": item_id, "owner_id": user["id"]})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# KANBAN + CALENDAR VIEWS
# ═══════════════════════════════════════════════════════════════
@router.get("/content/kanban")
async def kanban(user=Depends(current_user)):
    """Return items grouped by status."""
    result = {}
    for status in CONTENT_STATUSES:
        items = await db.content_items.find(
            {"owner_id": user["id"], "status": status["key"]}, {"_id": 0}
        ).sort("updated_at", -1).to_list(200)
        enriched = [await _enrich_content(x) for x in items]
        result[status["key"]] = {**status, "items": enriched, "count": len(enriched)}
    return result


@router.get("/content/calendar")
async def calendar(
    user=Depends(current_user),
    year: Optional[int] = None,
    month: Optional[int] = None,
):
    """Return items grouped by day (YYYY-MM-DD). Filters by scheduled_at OR published_at within given month/year."""
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    # Build ISO range strings
    from calendar import monthrange
    last_day = monthrange(y, m)[1]
    start = f"{y:04d}-{m:02d}-01T00:00:00"
    end = f"{y:04d}-{m:02d}-{last_day:02d}T23:59:59"

    items = await db.content_items.find(
        {
            "owner_id": user["id"],
            "$or": [
                {"scheduled_at": {"$gte": start, "$lte": end}},
                {"published_at": {"$gte": start, "$lte": end}},
            ],
        },
        {"_id": 0},
    ).sort("scheduled_at", 1).to_list(500)

    by_day = {}
    for item in items:
        dt_str = item.get("scheduled_at") or item.get("published_at") or ""
        day_key = dt_str[:10] if dt_str else "unscheduled"
        by_day.setdefault(day_key, []).append(await _enrich_content(item))

    return {"year": y, "month": m, "days": by_day, "count": len(items)}


# ═══════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════
@router.get("/content/stats")
async def content_stats(user=Depends(current_user)):
    owner_id = user["id"]
    all_items = await db.content_items.find({"owner_id": owner_id}, {"_id": 0}).to_list(5000)
    total = len(all_items)
    published = [i for i in all_items if i.get("status") == "published"]
    scheduled = [i for i in all_items if i.get("status") == "scheduled"]
    ideas = [i for i in all_items if i.get("status") == "idea"]
    drafts = [i for i in all_items if i.get("status") == "draft"]

    # published this month
    now = datetime.now(timezone.utc)
    month_prefix = f"{now.year:04d}-{now.month:02d}"
    published_this_month = [
        i for i in published if (i.get("published_at") or "").startswith(month_prefix)
    ]

    # by platform + by status
    by_platform = []
    for p in CONTENT_PLATFORMS:
        c = [i for i in all_items if i.get("platform") == p["key"]]
        by_platform.append({**p, "count": len(c)})
    by_status = []
    for s in CONTENT_STATUSES:
        c = [i for i in all_items if i.get("status") == s["key"]]
        by_status.append({**s, "count": len(c)})

    return {
        "total": total,
        "ideas": len(ideas),
        "drafts": len(drafts),
        "scheduled": len(scheduled),
        "published": len(published),
        "published_this_month": len(published_this_month),
        "by_platform": by_platform,
        "by_status": by_status,
    }


# ═══════════════════════════════════════════════════════════════
# AI HELPERS (Content-specific)
# ═══════════════════════════════════════════════════════════════
async def _ai_call(task_key: str, context: str, user_id: str) -> str:
    system_prompt = AI_PROMPTS.get(task_key)
    if not system_prompt:
        raise HTTPException(400, f"مهمة {task_key} غير معرّفة")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{user_id}-{task_key}-{uuid.uuid4()}",
            system_message=system_prompt,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=context)
        return await chat.send_message(msg)
    except Exception as e:
        logger.error(f"AI content error ({task_key}): {e}")
        raise HTTPException(500, f"خطأ في الذكاء الاصطناعي: {str(e)}")


@router.post("/content/ai/ideas")
async def ai_content_ideas(data: ContentAIRequest, user=Depends(current_user)):
    """Generate content ideas from a topic/context."""
    context = f"الموضوع: {data.topic}\nالمنصة المستهدفة: {data.platform}\nالصيغة: {data.format}"
    result = await _ai_call("content_ideas", context, user["id"])
    return {"result": result, "task": "content_ideas"}


@router.post("/content/ai/script")
async def ai_content_script(data: ContentAIRequest, user=Depends(current_user)):
    """Generate full script for a content item."""
    context = f"الفكرة: {data.topic}\nالمنصة: {data.platform}\nالصيغة: {data.format}"
    result = await _ai_call("content_script", context, user["id"])
    return {"result": result, "task": "content_script"}


@router.post("/content/ai/caption")
async def ai_improve_caption(data: ContentAIRequest, user=Depends(current_user)):
    """Improve caption text."""
    result = await _ai_call("content_caption", data.topic, user["id"])
    return {"result": result, "task": "content_caption"}


@router.post("/content/ai/hashtags")
async def ai_hashtags(data: ContentAIRequest, user=Depends(current_user)):
    """Suggest hashtags for content."""
    context = f"المحتوى: {data.topic}\nالمنصة: {data.platform}"
    result = await _ai_call("content_hashtags", context, user["id"])
    return {"result": result, "task": "content_hashtags"}


# Kept for backwards compat
@router.get("/content/ping")
async def content_ping():
    return {"engine": "content", "status": "active", "version": "v1"}
