"""Search Engine: search + explore/creators."""
from fastapi import APIRouter, Query

from core.deps import db

router = APIRouter(tags=["search"])


@router.get("/explore/creators")
async def explore_creators(limit: int = 20):
    return await db.users.find({}, {"_id": 0, "password": 0}).sort("followers", -1).to_list(limit)


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    users = await db.users.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
        ]},
        {"_id": 0, "password": 0}
    ).limit(30).to_list(30)
    videos = await db.videos.find(
        {"is_deleted": False, "$or": [
            {"caption": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]},
        {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30)
    for v in videos:
        v["creator"] = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "password": 0})
    return {"users": users, "videos": videos}
