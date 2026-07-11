"""Marketplace Engine: services, orders, project-requests, applications, reviews."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user, create_notification
from core.schemas import (
    ServiceCreate, OrderCreate, ReviewCreate,
    ProjectRequestCreate, ApplicationCreate,
)

router = APIRouter(tags=["marketplace"])


# ==================== SERVICES ====================
@router.post("/services")
async def create_service(data: ServiceCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": data.title,
        "description": data.description,
        "price": float(data.price),
        "delivery_days": data.delivery_days,
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/services/user/{username}")
async def user_services(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    services = await db.services.find({"user_id": user["id"], "is_active": True}, {"_id": 0}).to_list(100)
    return services


@router.get("/services/{service_id}")
async def get_service(service_id: str):
    s = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "الخدمة غير موجودة")
    u = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "password": 0})
    s["creator"] = u
    return s


@router.delete("/services/{service_id}")
async def delete_service(service_id: str, user=Depends(current_user)):
    s = await db.services.find_one({"id": service_id})
    if not s or s["user_id"] != user["id"]:
        raise HTTPException(404, "الخدمة غير موجودة")
    await db.services.update_one({"id": service_id}, {"$set": {"is_active": False}})
    return {"ok": True}


# ==================== ORDERS ====================
@router.post("/orders")
async def create_order(data: OrderCreate, user=Depends(current_user)):
    service = await db.services.find_one({"id": data.service_id})
    if not service:
        raise HTTPException(404, "الخدمة غير موجودة")
    order_id = str(uuid.uuid4())
    doc = {
        "id": order_id,
        "service_id": data.service_id,
        "client_id": user["id"],
        "creator_id": service["user_id"],
        "amount": float(service["price"]),
        "notes": data.notes,
        "status": "pending_payment",
        "payment_status": "unpaid",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    doc["service"] = {k: v for k, v in service.items() if k != "_id"}
    await create_notification(service["user_id"], "order", f"@{user['username']} طلب خدمة: {service['title']}", order_id, user["id"])
    return doc


@router.get("/orders/my")
async def my_orders(user=Depends(current_user)):
    as_client = await db.orders.find({"client_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    as_creator = await db.orders.find({"creator_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for o in as_client + as_creator:
        s = await db.services.find_one({"id": o["service_id"]}, {"_id": 0})
        o["service"] = s
        c = await db.users.find_one({"id": o["client_id"]}, {"_id": 0, "password": 0})
        cr = await db.users.find_one({"id": o["creator_id"]}, {"_id": 0, "password": 0})
        o["client"] = c
        o["creator"] = cr
    return {"as_client": as_client, "as_creator": as_creator}


@router.get("/orders/reviewed-ids")
async def reviewed_order_ids(user=Depends(current_user)):
    reviews = await db.reviews.find({"client_id": user["id"]}, {"_id": 0, "order_id": 1}).to_list(1000)
    return [r["order_id"] for r in reviews]


@router.post("/orders/{order_id}/deliver")
async def mark_delivered(order_id: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["creator_id"] != user["id"]:
        raise HTTPException(404, "الطلب غير موجود")
    if o["payment_status"] != "paid":
        raise HTTPException(400, "لم يتم دفع الطلب بعد")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "delivered"}})
    await create_notification(o["client_id"], "delivery", "تم تسليم طلبك ✓", order_id, user["id"])
    return {"ok": True}


# ==================== REVIEWS ====================
@router.post("/reviews")
async def create_review(data: ReviewCreate, user=Depends(current_user)):
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(400, "التقييم من 1 إلى 5")
    order = await db.orders.find_one({"id": data.order_id})
    if not order or order["client_id"] != user["id"]:
        raise HTTPException(404, "الطلب غير موجود")
    if order["payment_status"] != "paid":
        raise HTTPException(400, "لا يمكن تقييم طلب غير مدفوع")
    if await db.reviews.find_one({"order_id": data.order_id}):
        raise HTTPException(400, "تم تقييم هذا الطلب مسبقاً")
    doc = {
        "id": str(uuid.uuid4()),
        "order_id": data.order_id,
        "service_id": order["service_id"],
        "creator_id": order["creator_id"],
        "client_id": user["id"],
        "rating": data.rating,
        "text": data.text,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    await create_notification(order["creator_id"], "review", f"@{user['username']} قيّم خدمتك ({data.rating}★)", order["service_id"], user["id"])
    return doc


@router.get("/reviews/service/{service_id}")
async def service_reviews(service_id: str):
    reviews = await db.reviews.find({"service_id": service_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reviews:
        r["client"] = await db.users.find_one({"id": r["client_id"]}, {"_id": 0, "password": 0})
    avg = 0
    if reviews:
        avg = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
    return {"reviews": reviews, "average": avg, "count": len(reviews)}


# ==================== PROJECT REQUESTS ====================
@router.post("/project-requests")
async def create_project_request(data: ProjectRequestCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "budget_min": float(data.budget_min or 0),
        "budget_max": float(data.budget_max or 0),
        "deadline_days": int(data.deadline_days or 7),
        "status": "open",
        "applications_count": 0,
        "created_at": now_iso(),
    }
    await db.project_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/project-requests")
async def list_project_requests(category: Optional[str] = None):
    q = {"status": "open"}
    if category:
        q["category"] = category
    items = await db.project_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    for it in items:
        it["user"] = await db.users.find_one({"id": it["user_id"]}, {"_id": 0, "password": 0})
    return items


@router.get("/project-requests/{req_id}")
async def get_project_request(req_id: str):
    it = await db.project_requests.find_one({"id": req_id}, {"_id": 0})
    if not it:
        raise HTTPException(404, "الطلب غير موجود")
    it["user"] = await db.users.find_one({"id": it["user_id"]}, {"_id": 0, "password": 0})
    apps = await db.applications.find({"project_id": req_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for a in apps:
        a["user"] = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "password": 0})
    it["applications"] = apps
    return it


@router.post("/project-requests/{req_id}/apply")
async def apply_to_request(req_id: str, data: ApplicationCreate, user=Depends(current_user)):
    req = await db.project_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(404, "الطلب غير موجود")
    if req["user_id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك التقديم لطلبك")
    existing = await db.applications.find_one({"project_id": req_id, "user_id": user["id"]})
    if existing:
        raise HTTPException(400, "قدمت مسبقاً على هذا الطلب")
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": req_id,
        "user_id": user["id"],
        "message": data.message,
        "proposed_price": float(data.proposed_price or 0),
        "created_at": now_iso(),
    }
    await db.applications.insert_one(doc)
    await db.project_requests.update_one({"id": req_id}, {"$inc": {"applications_count": 1}})
    await create_notification(req["user_id"], "application", f"@{user['username']} قدّم على مشروعك: {req['title']}", req_id, user["id"])
    doc.pop("_id", None)
    return doc
