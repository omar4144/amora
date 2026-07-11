"""Events Engine: events + tickets."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, optional_user, create_notification
from core.schemas import EventCreate

router = APIRouter(tags=["events"])


@router.post("/events")
async def create_event(data: EventCreate, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "owner_id": user["id"], "title": data.title,
           "description": data.description, "kind": data.kind, "date": data.date,
           "location": data.location, "price": float(data.price), "capacity": int(data.capacity),
           "tickets_sold": 0, "created_at": now_iso()}
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/events")
async def list_events():
    items = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    for e in items:
        e["owner"] = await db.users.find_one({"id": e["owner_id"]}, {"_id": 0, "password": 0})
    return items


@router.get("/events/{event_id}")
async def get_event(event_id: str, viewer=Depends(optional_user)):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "الفعالية غير موجودة")
    e["owner"] = await db.users.find_one({"id": e["owner_id"]}, {"_id": 0, "password": 0})
    if viewer:
        t = await db.tickets.find_one({"event_id": event_id, "user_id": viewer["id"]})
        e["has_ticket"] = bool(t)
        e["ticket_code"] = t["code"] if t else None
    return e


@router.post("/events/{event_id}/register")
async def register_event(event_id: str, user=Depends(current_user)):
    e = await db.events.find_one({"id": event_id})
    if not e:
        raise HTTPException(404, "الفعالية غير موجودة")
    if await db.tickets.find_one({"event_id": event_id, "user_id": user["id"]}):
        raise HTTPException(400, "لديك تذكرة مسبقاً")
    if e["tickets_sold"] >= e["capacity"]:
        raise HTTPException(400, "اكتملت الفعالية")
    code = uuid.uuid4().hex[:10].upper()
    await db.tickets.insert_one({"id": str(uuid.uuid4()), "event_id": event_id,
                                 "user_id": user["id"], "code": code, "checked_in": False, "created_at": now_iso()})
    await db.events.update_one({"id": event_id}, {"$inc": {"tickets_sold": 1}})
    await create_notification(e["owner_id"], "event_register", f"@{user['username']} سجّل في فعاليتك", event_id, user["id"])
    return {"code": code}


@router.get("/events/my/tickets")
async def my_tickets(user=Depends(current_user)):
    tickets = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for t in tickets:
        t["event"] = await db.events.find_one({"id": t["event_id"]}, {"_id": 0})
    return tickets
