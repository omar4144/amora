"""Team Engine: create/list/get/join teams."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, optional_user, create_notification
from core.schemas import TeamCreate

router = APIRouter(tags=["team"])


@router.post("/teams")
async def create_team(data: TeamCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()), "owner_id": user["id"], "name": data.name,
        "description": data.description, "kind": data.kind or "team",
        "members_count": 1, "created_at": now_iso(),
    }
    await db.teams.insert_one(doc)
    await db.team_members.insert_one({
        "id": str(uuid.uuid4()), "team_id": doc["id"], "user_id": user["id"],
        "role": "owner", "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc


@router.get("/teams")
async def list_teams():
    items = await db.teams.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for t in items:
        t["owner"] = await db.users.find_one({"id": t["owner_id"]}, {"_id": 0, "password": 0})
    return items


@router.get("/teams/{team_id}")
async def get_team(team_id: str, viewer=Depends(optional_user)):
    t = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "الفريق غير موجود")
    t["owner"] = await db.users.find_one({"id": t["owner_id"]}, {"_id": 0, "password": 0})
    members = await db.team_members.find({"team_id": team_id}, {"_id": 0}).to_list(100)
    for m in members:
        m["user"] = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "password": 0})
    t["members"] = members
    if viewer:
        t["joined"] = bool(await db.team_members.find_one({"team_id": team_id, "user_id": viewer["id"]}))
    else:
        t["joined"] = False
    return t


@router.post("/teams/{team_id}/join")
async def join_team(team_id: str, user=Depends(current_user)):
    t = await db.teams.find_one({"id": team_id})
    if not t:
        raise HTTPException(404, "الفريق غير موجود")
    existing = await db.team_members.find_one({"team_id": team_id, "user_id": user["id"]})
    if existing:
        if existing["role"] == "owner":
            raise HTTPException(400, "أنت مالك الفريق")
        await db.team_members.delete_one({"_id": existing["_id"]})
        await db.teams.update_one({"id": team_id}, {"$inc": {"members_count": -1}})
        return {"joined": False}
    await db.team_members.insert_one({
        "id": str(uuid.uuid4()), "team_id": team_id, "user_id": user["id"],
        "role": "member", "created_at": now_iso(),
    })
    await db.teams.update_one({"id": team_id}, {"$inc": {"members_count": 1}})
    await create_notification(t["owner_id"], "team_join", f"@{user['username']} انضم لفريقك", team_id, user["id"])
    return {"joined": True}
