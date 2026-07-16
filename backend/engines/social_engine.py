"""Social Engine: users profiles, follow/unfollow, videos, comments, likes, views."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response

from core.deps import (
    db, now_iso, current_user, optional_user,
    put_object, get_object, APP_NAME, create_notification,
)
from core.security_utils import validate_image_bytes, validate_video_bytes
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
    """Upload profile avatar (image). Max 5MB, jpg/jpeg/png/webp — validated by magic bytes."""
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "حجم الصورة كبير (الحد 5MB)")
    detected_mime = validate_image_bytes(data, "الصورة الشخصية")
    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    ext = ext_map[detected_mime]
    path = f"{APP_NAME}/avatars/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, detected_mime)
    avatar_url = result.get("url") or result.get("public_url") or f"/api/uploads/{result.get('path', path)}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}


@router.get("/users/{username}/followers")
async def list_followers(username: str, viewer=Depends(optional_user)):
    """Return the list of users following {username}."""
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود")
    follows = await db.follows.find({"following_id": target["id"]}).sort("created_at", -1).to_list(500)
    ids = [f["follower_id"] for f in follows]
    if not ids:
        return []
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password": 0}).to_list(500)
    # attach is_following flag from viewer
    if viewer:
        my_follows = await db.follows.find({"follower_id": viewer["id"], "following_id": {"$in": ids}}).to_list(500)
        followed_ids = {f["following_id"] for f in my_follows}
        for u in users:
            u["is_following"] = u["id"] in followed_ids
    return users


@router.get("/users/{username}/following")
async def list_following(username: str, viewer=Depends(optional_user)):
    """Return the list of users that {username} is following."""
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(404, "المستخدم غير موجود")
    follows = await db.follows.find({"follower_id": target["id"]}).sort("created_at", -1).to_list(500)
    ids = [f["following_id"] for f in follows]
    if not ids:
        return []
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password": 0}).to_list(500)
    if viewer:
        my_follows = await db.follows.find({"follower_id": viewer["id"], "following_id": {"$in": ids}}).to_list(500)
        followed_ids = {f["following_id"] for f in my_follows}
        for u in users:
            u["is_following"] = u["id"] in followed_ids
    return users


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
    # Attach creator stats: orders_count, rating, primary_service
    if user:
        # completed orders as seller
        orders_count = await db.orders.count_documents({
            "creator_id": user["id"],
            "payment_status": "paid",
        })
        # avg rating from reviews on their services
        rating_agg = await db.reviews.aggregate([
            {"$match": {"creator_id": user["id"]}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
        ]).to_list(1)
        rating = round(rating_agg[0]["avg"], 1) if rating_agg else None
        reviews_count = rating_agg[0]["n"] if rating_agg else 0
        user["orders_count"] = orders_count
        user["rating"] = rating
        user["reviews_count"] = reviews_count
    v["creator"] = user

    # Primary service — the "killer card" attaches the creator's headline service
    if user:
        svc = await db.services.find_one(
            {"seller_id": user["id"], "is_active": {"$ne": False}},
            {"_id": 0},
            sort=[("orders_count", -1), ("created_at", -1)],
        )
        v["primary_service"] = svc

    if viewer_id:
        liked = await db.likes.find_one({"user_id": viewer_id, "video_id": v["id"]})
        v["liked"] = bool(liked)
        saved = await db.saves.find_one({"user_id": viewer_id, "video_id": v["id"]})
        v["saved"] = bool(saved)
    else:
        v["liked"] = False
        v["saved"] = False
    v.pop("_id", None)
    return v


@router.get("/videos/feed/following")
async def feed_following(viewer=Depends(current_user), limit: int = 20):
    """Videos from creators the viewer follows."""
    follows = await db.follows.find({"follower_id": viewer["id"]}).to_list(500)
    ids = [f["following_id"] for f in follows]
    if not ids:
        return []
    videos = await db.videos.find(
        {"user_id": {"$in": ids}, "is_deleted": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return [await enrich_video(v, viewer["id"]) for v in videos]


@router.post("/videos/{video_id}/save")
async def save_video(video_id: str, user=Depends(current_user)):
    v = await db.videos.find_one({"id": video_id, "is_deleted": False})
    if not v:
        raise HTTPException(404, "الفيديو غير موجود")
    existing = await db.saves.find_one({"user_id": user["id"], "video_id": video_id})
    if existing:
        return {"saved": True, "already": True}
    await db.saves.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "video_id": video_id,
        "created_at": now_iso(),
    })
    return {"saved": True}


@router.delete("/videos/{video_id}/save")
async def unsave_video(video_id: str, user=Depends(current_user)):
    res = await db.saves.delete_one({"user_id": user["id"], "video_id": video_id})
    return {"saved": False, "removed": res.deleted_count > 0}


@router.get("/videos/saved")
async def saved_videos(user=Depends(current_user), limit: int = 100):
    rows = await db.saves.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    ids = [r["video_id"] for r in rows]
    if not ids:
        return []
    videos = await db.videos.find({"id": {"$in": ids}, "is_deleted": False}, {"_id": 0}).to_list(limit)
    return [await enrich_video(v, user["id"]) for v in videos]


@router.post("/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    caption: str = Form(""),
    category: str = Form("عام"),
    thumbnail: Optional[UploadFile] = File(None),
    filter_name: str = Form(""),
    user=Depends(current_user),
):
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "حجم الملف كبير جداً (الحد الأقصى 100MB)")
    detected_mime = validate_video_bytes(data)
    ext_map = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v"}
    ext = ext_map[detected_mime]
    path = f"{APP_NAME}/videos/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, detected_mime)

    # Optional thumbnail (generated client-side from video canvas) — validate magic-bytes too
    thumbnail_url = None
    if thumbnail is not None:
        thumb_data = await thumbnail.read()
        if thumb_data and len(thumb_data) <= 3 * 1024 * 1024:  # 3MB cap
            try:
                t_mime = validate_image_bytes(thumb_data, "الصورة المصغّرة")
                t_ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
                t_ext = t_ext_map[t_mime]
                t_path = f"{APP_NAME}/videos/{user['id']}/thumbs/{uuid.uuid4()}.{t_ext}"
                t_result = put_object(t_path, thumb_data, t_mime)
                thumbnail_url = t_result.get("url") or t_result.get("public_url") or f"/api/uploads/{t_result.get('path', t_path)}"
            except HTTPException:
                # bad thumbnail — silently skip (video upload still succeeds)
                thumbnail_url = None

    video_id = str(uuid.uuid4())
    doc = {
        "id": video_id,
        "user_id": user["id"],
        "storage_path": result["path"],
        "content_type": file.content_type or "video/mp4",
        "caption": caption,
        "category": category,
        "thumbnail_url": thumbnail_url,
        "filter_name": filter_name or None,
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


@router.delete("/videos/{video_id}")
async def delete_video(video_id: str, user=Depends(current_user)):
    """Owner-only soft delete of a video (cascades likes & comments)."""
    v = await db.videos.find_one({"id": video_id, "is_deleted": False})
    if not v:
        raise HTTPException(404, "الفيديو غير موجود")
    if v["user_id"] != user["id"] and user.get("role") != "super_admin":
        raise HTTPException(403, "غير مصرح لك بحذف هذا الفيديو")
    await db.videos.update_one({"id": video_id}, {"$set": {"is_deleted": True, "deleted_at": now_iso()}})
    await db.comments.delete_many({"video_id": video_id})
    await db.likes.delete_many({"video_id": video_id})
    return {"deleted": True}


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
