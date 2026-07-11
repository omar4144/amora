"""Academy Engine: courses + enrollments."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, optional_user
from core.schemas import CourseCreate

router = APIRouter(tags=["academy"])


@router.post("/courses")
async def create_course(data: CourseCreate, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "owner_id": user["id"], "title": data.title,
           "description": data.description, "price": float(data.price),
           "lessons": data.lessons, "enrolled_count": 0, "created_at": now_iso()}
    await db.courses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/courses")
async def list_courses():
    items = await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for c in items:
        c["owner"] = await db.users.find_one({"id": c["owner_id"]}, {"_id": 0, "password": 0})
    return items


@router.get("/courses/{cid}")
async def get_course(cid: str, viewer=Depends(optional_user)):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "الدورة غير موجودة")
    c["owner"] = await db.users.find_one({"id": c["owner_id"]}, {"_id": 0, "password": 0})
    if viewer:
        c["enrolled"] = bool(await db.enrollments.find_one({"course_id": cid, "user_id": viewer["id"]}))
    return c


@router.post("/courses/{cid}/enroll")
async def enroll_course(cid: str, user=Depends(current_user)):
    c = await db.courses.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "الدورة غير موجودة")
    if await db.enrollments.find_one({"course_id": cid, "user_id": user["id"]}):
        raise HTTPException(400, "مسجّل مسبقاً")
    await db.enrollments.insert_one({"id": str(uuid.uuid4()), "course_id": cid,
                                     "user_id": user["id"], "progress": 0, "completed": False, "created_at": now_iso()})
    await db.courses.update_one({"id": cid}, {"$inc": {"enrolled_count": 1}})
    return {"ok": True}


@router.get("/courses/my/enrolled")
async def my_courses(user=Depends(current_user)):
    items = await db.enrollments.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for e in items:
        e["course"] = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0})
    return items
