"""Disputes Engine — marketplace order dispute resolution."""
import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core.deps import db, now_iso, current_user, create_notification

router = APIRouter(tags=["disputes"])
logger = logging.getLogger("amora.disputes")


# ==================== MODELS ====================
class DisputeCreate(BaseModel):
    order_id: str
    reason: str  # not_delivered | not_as_described | poor_quality | other
    description: str
    evidence_urls: List[str] = Field(default_factory=list)


class DisputeMessage(BaseModel):
    text: str


class DisputeResolve(BaseModel):
    resolution: str  # refund_buyer | release_to_seller | partial_refund
    partial_amount: Optional[float] = None
    admin_notes: Optional[str] = ""


VALID_REASONS = ["not_delivered", "not_as_described", "poor_quality", "other"]
VALID_RESOLUTIONS = ["refund_buyer", "release_to_seller", "partial_refund"]


REASON_LABELS = {
    "not_delivered":     "لم يتم التسليم",
    "not_as_described":  "لا يطابق الوصف",
    "poor_quality":      "جودة سيئة",
    "other":             "سبب آخر",
}


@router.get("/disputes/meta")
async def disputes_meta():
    return {"reasons": [{"key": k, "label": v} for k, v in REASON_LABELS.items()]}


# ==================== CREATE DISPUTE ====================
@router.post("/disputes")
async def create_dispute(data: DisputeCreate, user=Depends(current_user)):
    if data.reason not in VALID_REASONS:
        raise HTTPException(400, "سبب النزاع غير صالح")

    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    # NOTE: orders collection uses client_id (buyer) and creator_id (seller)
    buyer_id = order.get("buyer_id") or order.get("client_id")
    seller_id = order.get("seller_id") or order.get("creator_id")
    if buyer_id != user["id"]:
        raise HTTPException(403, "المشتري فقط يستطيع فتح نزاع")
    if order.get("status") not in ("paid", "delivered"):
        raise HTTPException(400, "لا يمكن فتح نزاع في هذه المرحلة")

    existing = await db.disputes.find_one({"order_id": data.order_id, "status": {"$nin": ["resolved", "closed"]}})
    if existing:
        raise HTTPException(409, "يوجد نزاع مفتوح لهذا الطلب")

    dispute_id = str(uuid.uuid4())
    doc = {
        "id": dispute_id,
        "order_id": data.order_id,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "amount": order.get("total_amount") or order.get("amount") or 0,
        "reason": data.reason,
        "description": data.description,
        "evidence_urls": data.evidence_urls,
        "status": "open",
        "messages": [{
            "id": str(uuid.uuid4()),
            "from_user_id": user["id"],
            "role": "buyer",
            "text": data.description,
            "created_at": now_iso(),
        }],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.disputes.insert_one(doc)
    await db.orders.update_one({"id": data.order_id}, {"$set": {"disputed": True, "dispute_id": dispute_id}})
    await create_notification(seller_id, "dispute", "تم فتح نزاع على طلبك — رجاءً راجعه", ref_id=dispute_id, from_user_id=user["id"])
    doc.pop("_id", None)
    return doc


# ==================== LIST + GET ====================
@router.get("/disputes")
async def list_my_disputes(user=Depends(current_user)):
    """Disputes where I'm buyer or seller."""
    items = await db.disputes.find(
        {"$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for d in items:
        d["role"] = "buyer" if d["buyer_id"] == user["id"] else "seller"
        other_id = d["seller_id"] if d["role"] == "buyer" else d["buyer_id"]
        d["counterparty"] = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
    return items


@router.get("/disputes/{dispute_id}")
async def get_dispute(dispute_id: str, user=Depends(current_user)):
    d = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "غير موجود")
    is_admin = user.get("role") in ("super_admin", "ceo", "moderator")
    if d["buyer_id"] != user["id"] and d["seller_id"] != user["id"] and not is_admin:
        raise HTTPException(403, "غير مصرح")
    d["role"] = ("admin" if is_admin and d["buyer_id"] != user["id"] and d["seller_id"] != user["id"]
                 else ("buyer" if d["buyer_id"] == user["id"] else "seller"))
    d["buyer"] = await db.users.find_one({"id": d["buyer_id"]}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
    d["seller"] = await db.users.find_one({"id": d["seller_id"]}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
    d["order"] = await db.orders.find_one({"id": d["order_id"]}, {"_id": 0})
    return d


# ==================== ADD MESSAGE ====================
@router.post("/disputes/{dispute_id}/messages")
async def add_message(dispute_id: str, data: DisputeMessage, user=Depends(current_user)):
    d = await db.disputes.find_one({"id": dispute_id})
    if not d:
        raise HTTPException(404, "غير موجود")
    is_admin = user.get("role") in ("super_admin", "ceo", "moderator")
    if d["buyer_id"] != user["id"] and d["seller_id"] != user["id"] and not is_admin:
        raise HTTPException(403, "غير مصرح")
    if d["status"] in ("resolved", "closed"):
        raise HTTPException(400, "النزاع مغلق")
    if not data.text.strip():
        raise HTTPException(400, "الرسالة فارغة")

    role = "admin" if is_admin and d["buyer_id"] != user["id"] and d["seller_id"] != user["id"] else ("buyer" if d["buyer_id"] == user["id"] else "seller")
    msg = {
        "id": str(uuid.uuid4()),
        "from_user_id": user["id"],
        "role": role,
        "text": data.text,
        "created_at": now_iso(),
    }
    await db.disputes.update_one(
        {"id": dispute_id},
        {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "status": "under_review" if d["status"] == "open" else d["status"]}},
    )
    # notify the other party
    target = d["seller_id"] if user["id"] == d["buyer_id"] else d["buyer_id"]
    await create_notification(target, "dispute", "رسالة جديدة في النزاع", ref_id=dispute_id, from_user_id=user["id"])
    return msg


# ==================== RESOLVE (admin only) ====================
@router.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: str, data: DisputeResolve, user=Depends(current_user)):
    if user.get("role") not in ("super_admin", "ceo", "moderator"):
        raise HTTPException(403, "الإدارة فقط تستطيع البت في النزاعات")
    if data.resolution not in VALID_RESOLUTIONS:
        raise HTTPException(400, "قرار غير صالح")
    d = await db.disputes.find_one({"id": dispute_id})
    if not d:
        raise HTTPException(404, "غير موجود")
    if d["status"] in ("resolved", "closed"):
        raise HTTPException(400, "النزاع مغلق مسبقاً")

    patch = {
        "status": "resolved",
        "resolution": data.resolution,
        "partial_amount": data.partial_amount,
        "admin_notes": data.admin_notes,
        "resolved_by": user["id"],
        "resolved_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.disputes.update_one({"id": dispute_id}, {"$set": patch})
    # update order flag
    order_status = "refunded" if data.resolution == "refund_buyer" else ("completed" if data.resolution == "release_to_seller" else "partially_refunded")
    await db.orders.update_one({"id": d["order_id"]}, {"$set": {"status": order_status}})
    # notify both parties
    for uid in [d["buyer_id"], d["seller_id"]]:
        await create_notification(uid, "dispute", f"تم حل النزاع: {data.resolution}", ref_id=dispute_id)
    return {"ok": True, **patch}


@router.post("/disputes/{dispute_id}/close")
async def close_dispute(dispute_id: str, user=Depends(current_user)):
    """Buyer withdraws the dispute."""
    d = await db.disputes.find_one({"id": dispute_id})
    if not d:
        raise HTTPException(404, "غير موجود")
    if d["buyer_id"] != user["id"]:
        raise HTTPException(403, "المشتري فقط يستطيع سحب النزاع")
    if d["status"] in ("resolved", "closed"):
        return {"ok": True}
    await db.disputes.update_one({"id": dispute_id}, {"$set": {"status": "closed", "closed_at": now_iso(), "updated_at": now_iso()}})
    await create_notification(d["seller_id"], "dispute", "قام المشتري بسحب النزاع", ref_id=dispute_id, from_user_id=user["id"])
    return {"ok": True}


# ==================== ADMIN: LIST ALL ====================
@router.get("/admin/disputes")
async def admin_list_disputes(status: Optional[str] = None, user=Depends(current_user)):
    if user.get("role") not in ("super_admin", "ceo", "moderator"):
        raise HTTPException(403, "الإدارة فقط")
    q = {}
    if status:
        q["status"] = status
    items = await db.disputes.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in items:
        d["buyer"] = await db.users.find_one({"id": d["buyer_id"]}, {"_id": 0, "name": 1, "username": 1})
        d["seller"] = await db.users.find_one({"id": d["seller_id"]}, {"_id": 0, "name": 1, "username": 1})
    return items
