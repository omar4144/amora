"""Social Engine: users profiles, follow/unfollow, videos, comments, likes, views."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response

from core.deps import (
    db, now_iso, current_user, optional_user,
    put_object, get_object, APP_NAME, create_notification,
)
from core.schemas import ProfileUpdate, CommentCreate

router = APIRouter(tags=["social"])


# ==================== USERS ====================
@router.get("/users/{username}")
async def get_user(username: str, viewer=Depends(optional_user)):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    if viewer:
        follow = await db.follows.find_one({"follower_id": viewer["id"], "following_id": user["id"]})
        user["is_following"] = bool(follow)
    else:
        user["is_following"] = False
    return user


@router.put("/users/me")
async def update_me(data: ProfileUpdate, user=Depends(current_user)):
    update = {"name": data.name, "bio": data.bio or ""}
    for f in ["role", "looking_for", "skills", "years_experience", "intro_video_url", "certifications", "portfolio", "avatar_url"]:
        val = getattr(data, f)
        if val is not None:
            update[f] = val
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})


@router.post("/users/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(current_user)):
    """Upload profile avatar (image). Max 5MB, jpg/jpeg/png/webp."""
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg").lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(400, "الصيغة غير مدعومة (jpg/png/webp)")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "حجم الصورة كبير (الحد 5MB)")
    path = f"{APP_NAME}/avatars/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or f"image/{ext}")
    avatar_url = result.get("url") or result.get("public_url") or f"/api/uploads/{result.get('path', path)}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}


@router.post("/users/{username}/follow")
async def follow_user(username: str, user=Depends(current_user)):
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود")
    if target["id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك متابعة نفسك")
    existing = await db.follows.find_one({"follower_id": user["id"], "following_id": target["id"]})
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        await db.users.update_one({"id": target["id"]}, {"$inc": {"followers": -1}})
        await db.users.update_one({"id": user["id"]}, {"$inc": {"following": -1}})
        return {"following": False}
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": user["id"],
        "following_id": target["id"],
        "created_at": now_iso(),
    })
    await db.users.update_one({"id": target["id"]}, {"$inc": {"followers": 1}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"following": 1}})
    return {"following": True}


# ==================== VIDEOS ====================
async def enrich_video(v: dict, viewer_id: Optional[str] = None):
    user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
    v["creator"] = user
    if viewer_id:
        liked = await db.likes.find_one({"user_id": viewer_id, "video_id": v["id"]})
        v["liked"] = bool(liked)
    else:
        v["liked"] = False
    v.pop("_id", None)
    return v


@router.post("/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    caption: str = Form(""),
    category: str = Form("عام"),
    user=Depends(current_user),
):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "mp4").lower()
    if ext not in ["mp4", "mov", "webm", "m4v"]:
        raise HTTPException(400, "صيغة الفيديو غير مدعومة")
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "حجم الملف كبير جداً (الحد الأقصى 100MB)")
    path = f"{APP_NAME}/videos/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "video/mp4")
    video_id = str(uuid.uuid4())
    doc = {
        "id": video_id,
        "user_id": user["id"],
        "storage_path": result["path"],
        "content_type": file.content_type or "video/mp4",
        "caption": caption,
        "category": category,
        "likes": 0,
        "comments_count": 0,
        "views": 0,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.videos.insert_one(doc)
    return await enrich_video(dict(doc), user["id"])


@router.get("/videos/feed")
async def feed(viewer=Depends(optional_user), limit: int = 20):
    videos = await db.videos.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    viewer_id = viewer["id"] if viewer else None
    return [await enrich_video(v, viewer_id) for v in videos]


@router.get("/videos/user/{username}")
async def user_videos(username: str, viewer=Depends(optional_user)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    videos = await db.videos.find({"user_id": user["id"], "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(100)
    viewer_id = viewer["id"] if viewer else None
    return [await enrich_video(v, viewer_id) for v in videos]


@router.get("/videos/stream/{video_id}")
async def stream_video(video_id: str):
    v = await db.videos.find_one({"id": video_id, "is_deleted": False})
    if not v:
        raise HTTPException(404, "الفيديو غير موجود")
    data, ct = get_object(v["storage_path"])
    return Response(content=data, media_type=v.get("content_type", ct))


@router.post("/videos/{video_id}/like")
async def like_video(video_id: str, user=Depends(current_user)):
    v = await db.videos.find_one({"id": video_id, "is_deleted": False})
    if not v:
        raise HTTPException(404, "الفيديو غير موجود")
    existing = await db.likes.find_one({"user_id": user["id"], "video_id": video_id})
    if existing:
        await db.likes.delete_one({"_id": existing["_id"]})
        await db.videos.update_one({"id": video_id}, {"$inc": {"likes": -1}})
        return {"liked": False}
    await db.likes.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "video_id": video_id,
        "created_at": now_iso(),
    })
    await db.videos.update_one({"id": video_id}, {"$inc": {"likes": 1}})
    return {"liked": True}


@router.post("/videos/{video_id}/view")
async def view_video(video_id: str):
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    return {"ok": True}


# ==================== COMMENTS ====================
@router.get("/videos/{video_id}/comments")
async def get_comments(video_id: str):
    comments = await db.comments.find({"video_id": video_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for c in comments:
        u = await db.users.find_one({"id": c["user_id"]}, {"_id": 0, "password": 0})
        c["user"] = u
    return comments


@router.post("/videos/{video_id}/comments")
async def add_comment(video_id: str, data: CommentCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": user["id"],
        "text": data.text,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    await db.videos.update_one({"id": video_id}, {"$inc": {"comments_count": 1}})
    doc.pop("_id", None)
    doc["user"] = user
    v = await db.videos.find_one({"id": video_id})
    if v:
        await create_notification(v["user_id"], "comment", f"@{user['username']} علّق على فيديوك", video_id, user["id"])
    return doc
