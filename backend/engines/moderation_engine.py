"""
Moderation Engine — user safety & content compliance.

Endpoints:
- POST /api/reports — any user can report a piece of content or another user
- GET /api/reports/me — my submitted reports
- POST /api/users/{username}/block — block a user (mutes them from your feed/DMs/comments)
- DELETE /api/users/{username}/block — unblock
- GET /api/users/me/blocks — list users I have blocked
- GET /api/admin/reports — super_admin dashboard for reports
- PUT /api/admin/reports/{id} — resolve / dismiss a report + optional action
"""
import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from core.deps import db, now_iso, current_user, create_notification
from core.rbac import require_capability

router = APIRouter(tags=["moderation"])


# ==================== SCHEMAS ====================
VALID_TARGET_TYPES = {"video", "user", "comment", "message", "service", "community_post"}
VALID_REASONS = {
    "spam": "رسائل مزعجة",
    "harassment": "تحرش أو إساءة",
    "hate_speech": "خطاب كراهية",
    "nudity": "محتوى غير لائق",
    "violence": "عنف",
    "misinformation": "معلومات مضللة",
    "copyright": "انتهاك حقوق ملكية",
    "scam": "احتيال",
    "other": "أخرى",
}
VALID_STATUSES = {"pending", "under_review", "resolved", "dismissed"}
VALID_ACTIONS = {"none", "content_removed", "user_warned", "user_banned"}


class ReportCreate(BaseModel):
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = ""


class ReportResolve(BaseModel):
    status: str  # resolved | dismissed
    action: str = "none"
    admin_notes: Optional[str] = ""


# ==================== USER-FACING REPORTS ====================
@router.get("/moderation/meta")
async def moderation_meta():
    return {
        "target_types": sorted(VALID_TARGET_TYPES),
        "reasons": [{"key": k, "label": v} for k, v in VALID_REASONS.items()],
    }


@router.post("/reports")
async def create_report(payload: ReportCreate, user=Depends(current_user)):
    if payload.target_type not in VALID_TARGET_TYPES:
        raise HTTPException(400, "نوع الإبلاغ غير صالح")
    if payload.reason not in VALID_REASONS:
        raise HTTPException(400, "سبب الإبلاغ غير صالح")

    # Prevent duplicate open reports from same reporter on same target
    dup = await db.reports.find_one({
        "reporter_id": user["id"],
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "status": {"$in": ["pending", "under_review"]},
    })
    if dup:
        raise HTTPException(409, "لديك بلاغ سابق على هذا العنصر قيد المراجعة")

    doc = {
        "id": str(uuid.uuid4()),
        "reporter_id": user["id"],
        "reporter_username": user.get("username"),
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "reason": payload.reason,
        "details": (payload.details or "").strip()[:2000],
        "status": "pending",
        "action": "none",
        "created_at": now_iso(),
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "report_id": doc["id"]}


@router.get("/reports/me")
async def my_reports(user=Depends(current_user)):
    rows = await db.reports.find({"reporter_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rows


# ==================== USER BLOCKS ====================
@router.post("/users/{username}/block")
async def block_user(username: str, user=Depends(current_user)):
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود")
    if target["id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك حظر نفسك")

    existing = await db.blocks.find_one({"user_id": user["id"], "blocked_id": target["id"]})
    if existing:
        return {"blocked": True, "already": True}

    await db.blocks.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "blocked_id": target["id"],
        "blocked_username": target.get("username"),
        "created_at": now_iso(),
    })
    # cascade: unfollow both directions (a blocked relationship shouldn't keep social ties)
    await db.follows.delete_many({
        "$or": [
            {"follower_id": user["id"], "following_id": target["id"]},
            {"follower_id": target["id"], "following_id": user["id"]},
        ]
    })
    return {"blocked": True}


@router.delete("/users/{username}/block")
async def unblock_user(username: str, user=Depends(current_user)):
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود")
    res = await db.blocks.delete_one({"user_id": user["id"], "blocked_id": target["id"]})
    return {"blocked": False, "removed": res.deleted_count > 0}


@router.get("/users/me/blocks")
async def my_blocks(user=Depends(current_user)):
    rows = await db.blocks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = [r["blocked_id"] for r in rows]
    users = []
    if ids:
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password": 0, "email": 0}).to_list(500)
    return {"blocks": rows, "users": users}


# ==================== ADMIN ====================
@router.get("/admin/reports")
async def admin_list_reports(
    admin=Depends(require_capability("admin.view_platform_stats")),
    status: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    limit: int = 200,
):
    q = {}
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(400, "الحالة غير صالحة")
        q["status"] = status
    if target_type:
        if target_type not in VALID_TARGET_TYPES:
            raise HTTPException(400, "نوع البلاغ غير صالح")
        q["target_type"] = target_type

    rows = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # enrich reporter info
    reporter_ids = list({r["reporter_id"] for r in rows})
    if reporter_ids:
        reporters = await db.users.find({"id": {"$in": reporter_ids}}, {"_id": 0, "id": 1, "username": 1, "name": 1, "avatar_url": 1}).to_list(500)
        rmap = {u["id"]: u for u in reporters}
        for r in rows:
            r["reporter"] = rmap.get(r["reporter_id"])
    return rows


@router.get("/admin/reports/stats")
async def admin_reports_stats(admin=Depends(require_capability("admin.view_platform_stats"))):
    total = await db.reports.count_documents({})
    pending = await db.reports.count_documents({"status": "pending"})
    under_review = await db.reports.count_documents({"status": "under_review"})
    resolved = await db.reports.count_documents({"status": "resolved"})
    dismissed = await db.reports.count_documents({"status": "dismissed"})
    return {"total": total, "pending": pending, "under_review": under_review, "resolved": resolved, "dismissed": dismissed}


@router.put("/admin/reports/{report_id}")
async def admin_resolve_report(
    report_id: str,
    payload: ReportResolve,
    admin=Depends(require_capability("admin.view_platform_stats")),
):
    if payload.status not in {"under_review", "resolved", "dismissed"}:
        raise HTTPException(400, "الحالة غير صالحة")
    if payload.action not in VALID_ACTIONS:
        raise HTTPException(400, "الإجراء غير صالح")

    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(404, "البلاغ غير موجود")

    # Apply action (content_removed / user_banned / user_warned)
    if payload.status == "resolved" and payload.action != "none":
        await _apply_action(report, payload.action, admin)

    await db.reports.update_one(
        {"id": report_id},
        {"$set": {
            "status": payload.status,
            "action": payload.action,
            "admin_notes": (payload.admin_notes or "").strip()[:2000],
            "resolved_at": now_iso(),
            "resolved_by": admin["id"],
        }},
    )

    # Notify reporter
    try:
        await create_notification(
            report["reporter_id"],
            "report_update",
            f"تم مراجعة بلاغك: {payload.status}",
            report_id,
            admin["id"],
        )
    except Exception:
        pass

    return {"ok": True, "status": payload.status, "action": payload.action}


async def _apply_action(report: dict, action: str, admin: dict):
    """Enforce moderation action based on report target."""
    ttype = report["target_type"]
    tid = report["target_id"]

    if action == "content_removed":
        if ttype == "video":
            await db.videos.update_one({"id": tid}, {"$set": {"is_deleted": True, "deleted_at": now_iso(), "deleted_reason": "moderation"}})
        elif ttype == "comment":
            await db.comments.delete_one({"id": tid})
        elif ttype == "message":
            await db.messages.update_one({"id": tid}, {"$set": {"is_deleted": True}})
        elif ttype == "service":
            await db.services.update_one({"id": tid}, {"$set": {"is_active": False}})
        elif ttype == "community_post":
            await db.community_posts.update_one({"id": tid}, {"$set": {"is_deleted": True}})

    elif action == "user_banned":
        # Find owner of the content
        owner_id = None
        if ttype == "user":
            owner_id = tid
        elif ttype == "video":
            v = await db.videos.find_one({"id": tid})
            owner_id = v.get("user_id") if v else None
        elif ttype == "comment":
            c = await db.comments.find_one({"id": tid})
            owner_id = c.get("user_id") if c else None
        elif ttype == "message":
            m = await db.messages.find_one({"id": tid})
            owner_id = m.get("from_id") if m else None
        elif ttype == "service":
            s = await db.services.find_one({"id": tid})
            owner_id = s.get("seller_id") if s else None
        if owner_id:
            await db.users.update_one({"id": owner_id}, {"$set": {"is_banned": True, "banned_at": now_iso(), "banned_by": admin["id"]}})

    elif action == "user_warned":
        # warn the content owner via a notification
        owner_id = None
        if ttype == "user":
            owner_id = tid
        elif ttype == "video":
            v = await db.videos.find_one({"id": tid})
            owner_id = v.get("user_id") if v else None
        if owner_id:
            try:
                await create_notification(owner_id, "moderation_warning", "تلقّيت تحذيراً من الإدارة بشأن أحد أعمالك", tid, admin["id"])
            except Exception:
                pass
