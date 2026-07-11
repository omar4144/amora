"""Incubator Engine: 7-stage idea development."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, INCUBATOR_STAGES
from core.schemas import IdeaCreate, StageUpdate

router = APIRouter(tags=["incubator"])


@router.get("/incubator/stages")
async def get_stages():
    return INCUBATOR_STAGES


@router.post("/incubator/ideas")
async def create_idea(data: IdeaCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "title": data.title, "description": data.description,
        "stages": [{"stage": s["id"], "progress": 0, "notes": ""} for s in INCUBATOR_STAGES],
        "overall_progress": 0, "created_at": now_iso(),
    }
    await db.ideas.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/incubator/ideas")
async def list_my_ideas(user=Depends(current_user)):
    return await db.ideas.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.get("/incubator/ideas/{idea_id}")
async def get_idea(idea_id: str, user=Depends(current_user)):
    it = await db.ideas.find_one({"id": idea_id, "user_id": user["id"]}, {"_id": 0})
    if not it:
        raise HTTPException(404, "الفكرة غير موجودة")
    return it


@router.put("/incubator/ideas/{idea_id}/stage")
async def update_stage(idea_id: str, data: StageUpdate, user=Depends(current_user)):
    it = await db.ideas.find_one({"id": idea_id, "user_id": user["id"]})
    if not it:
        raise HTTPException(404, "الفكرة غير موجودة")
    stages = it["stages"]
    for s in stages:
        if s["stage"] == data.stage:
            s["progress"] = max(0, min(100, data.progress))
            if data.notes is not None:
                s["notes"] = data.notes
    overall = round(sum(s["progress"] for s in stages) / (7 * 100) * 100)
    await db.ideas.update_one(
        {"id": idea_id},
        {"$set": {"stages": stages, "overall_progress": overall}}
    )
    return await db.ideas.find_one({"id": idea_id}, {"_id": 0})
