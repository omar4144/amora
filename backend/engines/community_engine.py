"""Community Engine: communities list/get/join + posts + post likes."""
import re
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from core.deps import db, now_iso, current_user, optional_user
from core.schemas import PostCreate

router = APIRouter(tags=["community"])


class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "🌱"


def _slugify(name: str) -> str:
    s = re.sub(r"\s+", "-", name.strip().lower())
    s = re.sub(r"[^\w\-\u0600-\u06FF]", "", s)
    return s or f"c-{uuid.uuid4().hex[:8]}"


@router.get("/communities")
async def list_communities(viewer=Depends(optional_user), q: Optional[str] = None):
    query = {}
    if q and q.strip():
        query["$or"] = [
            {"name": {"$regex": q.strip(), "$options": "i"}},
            {"slug": {"$regex": q.strip(), "$options": "i"}},
            {"description": {"$regex": q.strip(), "$options": "i"}},
        ]
    items = await db.communities.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    if viewer:
        joined = await db.community_members.find({"user_id": viewer["id"]}, {"_id": 0}).to_list(200)
        joined_set = {j["community_slug"] for j in joined}
        for c in items:
            c["joined"] = c["slug"] in joined_set
    else:
        for c in items:
            c["joined"] = False
    # attach members count
    for c in items:
        c["members_count"] = await db.community_members.count_documents({"community_slug": c["slug"]})
    return items


@router.post("/communities")
async def create_community(data: CommunityCreate, user=Depends(current_user)):
    if not data.name.strip():
        raise HTTPException(400, "الاسم مطلوب")
    slug = _slugify(data.name)
    # ensure unique slug
    if await db.communities.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "name": data.name.strip(),
        "description": (data.description or "").strip(),
        "icon": (data.icon or "🌱")[:4],
        "owner_id": user["id"],
        "created_at": now_iso(),
    }
    await db.communities.insert_one(doc)
    # auto-join creator
    await db.community_members.insert_one({
        "id": str(uuid.uuid4()), "community_slug": slug, "user_id": user["id"], "role": "owner", "created_at": now_iso(),
    })
    doc.pop("_id", None)
    doc["joined"] = True
    doc["members_count"] = 1
    return doc


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
