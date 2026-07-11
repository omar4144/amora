"""Community Engine: communities list/get/join + posts + post likes."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, optional_user
from core.schemas import PostCreate

router = APIRouter(tags=["community"])


@router.get("/communities")
async def list_communities(viewer=Depends(optional_user)):
    items = await db.communities.find({}, {"_id": 0}).to_list(50)
    if viewer:
        joined = await db.community_members.find({"user_id": viewer["id"]}, {"_id": 0}).to_list(50)
        joined_set = {j["community_slug"] for j in joined}
        for c in items:
            c["joined"] = c["slug"] in joined_set
    else:
        for c in items:
            c["joined"] = False
    return items


@router.get("/communities/{slug}")
async def get_community(slug: str, viewer=Depends(optional_user)):
    c = await db.communities.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(404, "المجتمع غير موجود")
    c["members_count"] = await db.community_members.count_documents({"community_slug": slug})
    if viewer:
        c["joined"] = bool(await db.community_members.find_one({"community_slug": slug, "user_id": viewer["id"]}))
    else:
        c["joined"] = False
    return c


@router.post("/communities/{slug}/join")
async def join_community(slug: str, user=Depends(current_user)):
    c = await db.communities.find_one({"slug": slug})
    if not c:
        raise HTTPException(404, "المجتمع غير موجود")
    existing = await db.community_members.find_one({"community_slug": slug, "user_id": user["id"]})
    if existing:
        await db.community_members.delete_one({"_id": existing["_id"]})
        return {"joined": False}
    await db.community_members.insert_one({
        "id": str(uuid.uuid4()), "community_slug": slug, "user_id": user["id"], "created_at": now_iso()
    })
    return {"joined": True}


@router.get("/communities/{slug}/posts")
async def list_posts(slug: str, viewer=Depends(optional_user)):
    posts = await db.community_posts.find({"community_slug": slug}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for p in posts:
        p["user"] = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "password": 0})
        if viewer:
            p["liked"] = bool(await db.post_likes.find_one({"post_id": p["id"], "user_id": viewer["id"]}))
        else:
            p["liked"] = False
    return posts


@router.post("/communities/{slug}/posts")
async def create_post(slug: str, data: PostCreate, user=Depends(current_user)):
    c = await db.communities.find_one({"slug": slug})
    if not c:
        raise HTTPException(404, "المجتمع غير موجود")
    doc = {
        "id": str(uuid.uuid4()), "community_slug": slug, "user_id": user["id"],
        "text": data.text, "likes": 0, "comments_count": 0, "created_at": now_iso(),
    }
    await db.community_posts.insert_one(doc)
    doc.pop("_id", None)
    doc["user"] = user
    doc["liked"] = False
    return doc


@router.post("/posts/{post_id}/like")
async def like_post(post_id: str, user=Depends(current_user)):
    existing = await db.post_likes.find_one({"post_id": post_id, "user_id": user["id"]})
    if existing:
        await db.post_likes.delete_one({"_id": existing["_id"]})
        await db.community_posts.update_one({"id": post_id}, {"$inc": {"likes": -1}})
        return {"liked": False}
    await db.post_likes.insert_one({
        "id": str(uuid.uuid4()), "post_id": post_id, "user_id": user["id"], "created_at": now_iso()
    })
    await db.community_posts.update_one({"id": post_id}, {"$inc": {"likes": 1}})
    return {"liked": True}
