"""Notification Engine: notifications list/mark-seen + direct messages."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, create_notification, conv_id
from core.schemas import MessageCreate

router = APIRouter(tags=["notification"])


# ==================== NOTIFICATIONS ====================
@router.get("/notifications")
async def get_notifications(user=Depends(current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for n in items:
        if n.get("from_user_id"):
            n["from_user"] = await db.users.find_one({"id": n["from_user_id"]}, {"_id": 0, "password": 0})
    unseen = await db.notifications.count_documents({"user_id": user["id"], "seen": False})
    return {"items": items, "unseen": unseen}


@router.post("/notifications/mark-seen")
async def mark_seen(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "seen": False}, {"$set": {"seen": True}})
    return {"ok": True}


# ==================== MESSAGES ====================
@router.get("/messages/conversations")
async def conversations(user=Depends(current_user)):
    pipeline = [
        {"$match": {"$or": [{"sender_id": user["id"]}, {"receiver_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$conv_id", "last": {"$first": "$$ROOT"}}},
        {"$sort": {"last.created_at": -1}},
    ]
    convs = await db.messages.aggregate(pipeline).to_list(200)
    result = []
    for c in convs:
        last = c["last"]
        other_id = last["receiver_id"] if last["sender_id"] == user["id"] else last["sender_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        unread = await db.messages.count_documents({
            "conv_id": last["conv_id"], "receiver_id": user["id"], "seen": False
        })
        result.append({
            "conv_id": last["conv_id"],
            "user": other,
            "last_text": last["text"],
            "last_at": last["created_at"],
            "unread": unread,
        })
    return result


@router.get("/messages/with/{username}")
async def messages_with(username: str, user=Depends(current_user)):
    other = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not other:
        raise HTTPException(404, "المستخدم غير موجود")
    conv = conv_id(user["id"], other["id"])
    msgs = await db.messages.find({"conv_id": conv}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.messages.update_many(
        {"conv_id": conv, "receiver_id": user["id"], "seen": False},
        {"$set": {"seen": True}}
    )
    return {"user": other, "messages": msgs}


@router.post("/messages/with/{username}")
async def send_message(username: str, data: MessageCreate, user=Depends(current_user)):
    other = await db.users.find_one({"username": username})
    if not other:
        raise HTTPException(404, "المستخدم غير موجود")
    if other["id"] == user["id"]:
        raise HTTPException(400, "لا يمكن مراسلة نفسك")
    conv = conv_id(user["id"], other["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "conv_id": conv,
        "sender_id": user["id"],
        "receiver_id": other["id"],
        "text": data.text,
        "seen": False,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    await create_notification(other["id"], "message", f"@{user['username']} أرسل لك رسالة", user["username"], user["id"])
    return doc
