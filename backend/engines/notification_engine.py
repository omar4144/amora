"""Notification Engine: notifications list/mark-seen + direct messages + media."""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form

from core.deps import db, now_iso, current_user, create_notification, conv_id, put_object, APP_NAME
from core.schemas import MessageCreate

router = APIRouter(tags=["notification"])
logger = logging.getLogger("amora.notif")


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
    if not data.text.strip() and not data.media_url:
        raise HTTPException(400, "الرسالة فارغة")
    conv = conv_id(user["id"], other["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "conv_id": conv,
        "sender_id": user["id"],
        "receiver_id": other["id"],
        "text": data.text,
        "media_url": data.media_url,
        "media_type": data.media_type,
        "seen": False,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    # WebSocket live push to receiver
    try:
        from engines.realtime_engine import manager as _ws
        await _ws.send_to_user(other["id"], "message", {**doc, "from_username": user["username"]})
    except Exception:
        pass
    preview = data.text.strip() or ("📎 " + (data.media_type or "ملف"))
    await create_notification(other["id"], "message", f"@{user['username']}: {preview[:60]}", user["username"], user["id"])
    return doc


# ==================== MEDIA UPLOAD FOR DMs ====================
@router.post("/messages/media")
async def upload_message_media(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload media (image/video/file) for a DM. Returns {media_url, media_type} to be sent via /messages/with/{u}."""
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin").lower()
    ct = (file.content_type or "").lower()
    if ct.startswith("image/"):
        media_type = "image"
        if ext not in ["jpg", "jpeg", "png", "webp", "gif"]:
            raise HTTPException(400, "صيغة الصورة غير مدعومة")
        max_size = 10 * 1024 * 1024
    elif ct.startswith("video/"):
        media_type = "video"
        if ext not in ["mp4", "mov", "webm", "m4v"]:
            raise HTTPException(400, "صيغة الفيديو غير مدعومة")
        max_size = 50 * 1024 * 1024
    else:
        media_type = "file"
        if ext in ["exe", "sh", "bat", "cmd", "js", "php"]:
            raise HTTPException(400, "نوع الملف غير مسموح")
        max_size = 20 * 1024 * 1024

    data = await file.read()
    if len(data) > max_size:
        raise HTTPException(400, f"الحجم يتجاوز الحد ({max_size // 1024 // 1024}MB)")
    path = f"{APP_NAME}/dm/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "application/octet-stream")
    media_url = result.get("url") or result.get("public_url") or f"/api/uploads/{result.get('path', path)}"
    return {"media_url": media_url, "media_type": media_type, "filename": file.filename}
