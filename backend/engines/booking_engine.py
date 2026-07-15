"""Booking Engine — Digital Twin: spaces + Stripe checkout + QR entry passes."""
import uuid
import io
import logging
import base64
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.deps import db, current_user, optional_user, now_iso, STRIPE_API_KEY, create_notification

router = APIRouter(tags=["booking"])
logger = logging.getLogger("ruaa.booking")


# ==================== MODELS ====================
class SpaceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    location: str  # e.g., "الرياض - العليا"
    address: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_per_hour: float = 0.0
    currency: str = "USD"
    capacity: int = 1
    amenities: List[str] = Field(default_factory=list)  # ["wifi","projector","coffee"]
    images: List[str] = Field(default_factory=list)
    category: str = "studio"  # studio / meeting_room / office / event_hall


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_per_hour: Optional[float] = None
    capacity: Optional[int] = None
    amenities: Optional[List[str]] = None
    images: Optional[List[str]] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class BookingRequest(BaseModel):
    start_time: str  # ISO
    end_time: str  # ISO
    notes: Optional[str] = ""
    origin_url: str


CATEGORIES = [
    {"key": "studio",       "label": "استوديو"},
    {"key": "meeting_room", "label": "قاعة اجتماعات"},
    {"key": "office",       "label": "مكتب مشترك"},
    {"key": "event_hall",   "label": "قاعة فعاليات"},
]

AMENITIES = ["wifi", "projector", "whiteboard", "coffee", "parking", "sound_system", "camera_setup", "green_screen"]


# ==================== SPACES CRUD ====================
@router.get("/booking/meta")
async def booking_meta():
    return {"categories": CATEGORIES, "amenities": AMENITIES}


@router.get("/booking/spaces")
async def list_spaces(
    viewer=Depends(optional_user),
    category: Optional[str] = None,
    q: Optional[str] = None,
    max_price: Optional[float] = None,
):
    query = {"is_active": {"$ne": False}}
    if category:
        query["category"] = category
    if q and q.strip():
        query["$or"] = [
            {"name": {"$regex": q.strip(), "$options": "i"}},
            {"location": {"$regex": q.strip(), "$options": "i"}},
            {"description": {"$regex": q.strip(), "$options": "i"}},
        ]
    if max_price is not None:
        query["price_per_hour"] = {"$lte": max_price}
    items = await db.spaces.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in items:
        owner = await db.users.find_one({"id": s["owner_id"]}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
        s["owner"] = owner
    return items


@router.get("/booking/spaces/{space_id}")
async def get_space(space_id: str, viewer=Depends(optional_user)):
    s = await db.spaces.find_one({"id": space_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "المساحة غير موجودة")
    owner = await db.users.find_one({"id": s["owner_id"]}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1, "bio": 1})
    s["owner"] = owner
    return s


@router.post("/booking/spaces")
async def create_space(data: SpaceCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        **data.model_dump(),
        "is_active": True,
        "rating": None,
        "bookings_count": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.spaces.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/booking/spaces/{space_id}")
async def update_space(space_id: str, data: SpaceUpdate, user=Depends(current_user)):
    s = await db.spaces.find_one({"id": space_id, "owner_id": user["id"]})
    if not s:
        raise HTTPException(404, "غير مصرح")
    patch = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = now_iso()
    await db.spaces.update_one({"id": space_id}, {"$set": patch})
    return await db.spaces.find_one({"id": space_id}, {"_id": 0})


@router.delete("/booking/spaces/{space_id}")
async def delete_space(space_id: str, user=Depends(current_user)):
    r = await db.spaces.delete_one({"id": space_id, "owner_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "غير مصرح")
    return {"ok": True}


@router.get("/booking/my-spaces")
async def my_spaces(user=Depends(current_user)):
    return await db.spaces.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ==================== AVAILABILITY + BOOKING ====================
async def _overlap_exists(space_id: str, start: str, end: str) -> bool:
    conflict = await db.space_bookings.find_one({
        "space_id": space_id,
        "status": {"$in": ["confirmed", "pending"]},
        "start_time": {"$lt": end},
        "end_time": {"$gt": start},
    })
    return bool(conflict)


@router.get("/booking/spaces/{space_id}/availability")
async def check_availability(space_id: str, start: str = Query(...), end: str = Query(...)):
    available = not await _overlap_exists(space_id, start, end)
    return {"available": available}


@router.post("/booking/spaces/{space_id}/book")
async def book_space(space_id: str, data: BookingRequest, request: Request, user=Depends(current_user)):
    s = await db.spaces.find_one({"id": space_id})
    if not s:
        raise HTTPException(404, "المساحة غير موجودة")
    if s["owner_id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك حجز مساحتك الخاصة")
    # validate times
    try:
        start_dt = datetime.fromisoformat(data.start_time.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(data.end_time.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(400, "توقيت غير صالح")
    if end_dt <= start_dt:
        raise HTTPException(400, "نهاية الحجز يجب أن تكون بعد بدايته")
    if start_dt < datetime.now(timezone.utc):
        raise HTTPException(400, "لا يمكن الحجز في الماضي")
    if await _overlap_exists(space_id, data.start_time, data.end_time):
        raise HTTPException(409, "الوقت محجوز مسبقاً")

    hours = (end_dt - start_dt).total_seconds() / 3600
    amount = round(hours * float(s["price_per_hour"] or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "قيمة الحجز صفر")

    # Second-chance overlap check just before creating Stripe session (race prevention)
    if await _overlap_exists(space_id, data.start_time, data.end_time):
        raise HTTPException(409, "الوقت محجوز مسبقاً")

    # create Stripe checkout
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")

    success_url = f"{data.origin_url.rstrip('/')}/booking/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url.rstrip('/')}/booking/spaces/{space_id}"

    req = CheckoutSessionRequest(
        amount=amount,
        currency=s.get("currency", "usd").lower(),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"source": "space_booking", "space_id": space_id, "user_id": user["id"]},
    )
    session = await stripe_checkout.create_checkout_session(req)

    # pre-create booking in pending state
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "space_id": space_id,
        "guest_id": user["id"],
        "owner_id": s["owner_id"],
        "start_time": data.start_time,
        "end_time": data.end_time,
        "hours": round(hours, 2),
        "amount": amount,
        "currency": s.get("currency", "USD"),
        "notes": data.notes or "",
        "status": "pending",
        "session_id": session.session_id,
        "qr_code": f"AMORA-BOOK-{booking_id[:8].upper()}",
        "created_at": now_iso(),
    }
    await db.space_bookings.insert_one(booking)

    # log payment
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": session.session_id,
        "amount": amount,
        "currency": s.get("currency", "usd").lower(),
        "metadata": {"source": "space_booking", "space_id": space_id, "booking_id": booking_id},
        "payment_status": "initiated",
        "status": "initiated",
        "created_at": now_iso(),
    })

    return {"url": session.url, "session_id": session.session_id, "booking_id": booking_id, "amount": amount}


@router.get("/booking/status/{session_id}")
async def booking_status(session_id: str, request: Request, user=Depends(current_user)):
    """Poll Stripe status and confirm booking."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    status = await stripe_checkout.get_checkout_status(session_id)

    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]})
    if not txn:
        raise HTTPException(404, "لم يتم العثور على العملية")

    booking = await db.space_bookings.find_one({"session_id": session_id, "guest_id": user["id"]}, {"_id": 0})

    if status.payment_status == "paid" and booking and booking["status"] != "confirmed":
        await db.space_bookings.update_one(
            {"id": booking["id"]},
            {"$set": {"status": "confirmed", "confirmed_at": now_iso()}},
        )
        await db.spaces.update_one({"id": booking["space_id"]}, {"$inc": {"bookings_count": 1}})
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "completed"}},
        )
        # notify owner
        space = await db.spaces.find_one({"id": booking["space_id"]}, {"_id": 0, "name": 1})
        await create_notification(
            booking["owner_id"], "booking",
            f"حجز جديد لـ '{(space or {}).get('name','مساحتك')}'",
            ref_id=booking["id"],
        )
        booking["status"] = "confirmed"

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "booking": booking,
    }


@router.get("/booking/my-bookings")
async def my_bookings(user=Depends(current_user)):
    items = await db.space_bookings.find({"guest_id": user["id"]}, {"_id": 0}).sort("start_time", -1).to_list(200)
    for b in items:
        s = await db.spaces.find_one({"id": b["space_id"]}, {"_id": 0, "name": 1, "location": 1, "images": 1})
        b["space"] = s
    return items


@router.get("/booking/spaces/{space_id}/bookings")
async def space_bookings(space_id: str, user=Depends(current_user)):
    s = await db.spaces.find_one({"id": space_id, "owner_id": user["id"]})
    if not s:
        raise HTTPException(403, "غير مصرح")
    items = await db.space_bookings.find({"space_id": space_id}, {"_id": 0}).sort("start_time", -1).to_list(200)
    for b in items:
        guest = await db.users.find_one({"id": b["guest_id"]}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
        b["guest"] = guest
    return items


@router.get("/booking/bookings/{booking_id}/qr")
async def booking_qr(booking_id: str, user=Depends(current_user)):
    """Return PNG QR code containing the booking code. Only guest or space owner can access."""
    b = await db.space_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b or (b["guest_id"] != user["id"] and b["owner_id"] != user["id"]):
        raise HTTPException(404, "لم يتم العثور على الحجز")
    if b["status"] != "confirmed":
        raise HTTPException(400, "الحجز غير مؤكد")
    import qrcode
    img = qrcode.make(b["qr_code"])
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.post("/booking/bookings/{booking_id}/scan")
async def scan_booking(booking_id: str, user=Depends(current_user)):
    """Space owner scans the QR to mark booking as attended."""
    b = await db.space_bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["owner_id"] != user["id"]:
        raise HTTPException(403, "غير مصرح — فقط مالك المساحة")
    if b["status"] != "confirmed":
        raise HTTPException(400, "الحجز غير مؤكد")
    await db.space_bookings.update_one({"id": booking_id}, {"$set": {"status": "attended", "attended_at": now_iso()}})
    await create_notification(b["guest_id"], "booking", "تم تأكيد حضورك للمساحة ✓", ref_id=booking_id)
    return {"ok": True}


@router.post("/booking/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(current_user)):
    b = await db.space_bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "غير موجود")
    if b["guest_id"] != user["id"] and b["owner_id"] != user["id"]:
        raise HTTPException(403, "غير مصرح")
    if b["status"] == "cancelled":
        return {"ok": True}
    was_confirmed = b["status"] == "confirmed"
    await db.space_bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled", "cancelled_at": now_iso()}})
    if was_confirmed:
        # keep bookings_count consistent
        await db.spaces.update_one({"id": b["space_id"], "bookings_count": {"$gt": 0}}, {"$inc": {"bookings_count": -1}})
    return {"ok": True}
