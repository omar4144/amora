from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Query, Request
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = os.environ.get('APP_NAME', 'creator-hub')

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=180
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    except jwt.PyJWTError:
        return None


# ==================== MODELS ====================
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ServiceCreate(BaseModel):
    title: str
    description: str
    price: float
    delivery_days: int = 3

class CommentCreate(BaseModel):
    text: str

class OrderCreate(BaseModel):
    service_id: str
    notes: Optional[str] = ""

class CheckoutRequest(BaseModel):
    order_id: str
    origin_url: str

class ReviewCreate(BaseModel):
    order_id: str
    rating: int  # 1-5
    text: Optional[str] = ""

class MessageCreate(BaseModel):
    text: str

PLATFORM_FEE_PERCENT = 10.0

async def create_notification(user_id: str, type_: str, text: str, ref_id: str = "", from_user_id: str = ""):
    if user_id == from_user_id:
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "text": text,
        "ref_id": ref_id,
        "from_user_id": from_user_id,
        "seen": False,
        "created_at": now_iso(),
    })


# ==================== AUTH ====================
@api_router.post("/auth/signup")
async def signup(data: SignupRequest):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "البريد الإلكتروني مسجل مسبقاً")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "اسم المستخدم غير متاح")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "name": data.name,
        "password": hash_password(data.password),
        "bio": "",
        "avatar_url": "",
        "is_creator": True,
        "followers": 0,
        "following": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    doc.pop("_id", None)
    return {"token": token, "user": {k: v for k, v in doc.items() if k != "password"}}

@api_router.post("/auth/login")
async def login(data: LoginRequest):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    token = create_token(user["id"])
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ==================== USERS ====================
@api_router.get("/users/{username}")
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

@api_router.put("/users/me")
async def update_me(bio: str = Form(""), name: str = Form(...), user=Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"bio": bio, "name": name}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

@api_router.post("/users/{username}/follow")
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
    v["creator"] = user
    if viewer_id:
        liked = await db.likes.find_one({"user_id": viewer_id, "video_id": v["id"]})
        v["liked"] = bool(liked)
    else:
        v["liked"] = False
    v.pop("_id", None)
    return v

@api_router.post("/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    caption: str = Form(""),
    category: str = Form("عام"),
    user=Depends(current_user),
):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "mp4").lower()
    if ext not in ["mp4", "mov", "webm", "m4v"]:
        raise HTTPException(400, "صيغة الفيديو غير مدعومة")
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "حجم الملف كبير جداً (الحد الأقصى 100MB)")
    path = f"{APP_NAME}/videos/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "video/mp4")
    video_id = str(uuid.uuid4())
    doc = {
        "id": video_id,
        "user_id": user["id"],
        "storage_path": result["path"],
        "content_type": file.content_type or "video/mp4",
        "caption": caption,
        "category": category,
        "likes": 0,
        "comments_count": 0,
        "views": 0,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.videos.insert_one(doc)
    return await enrich_video(dict(doc), user["id"])

@api_router.get("/videos/feed")
async def feed(viewer=Depends(optional_user), limit: int = 20):
    videos = await db.videos.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    viewer_id = viewer["id"] if viewer else None
    return [await enrich_video(v, viewer_id) for v in videos]

@api_router.get("/videos/user/{username}")
async def user_videos(username: str, viewer=Depends(optional_user)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    videos = await db.videos.find({"user_id": user["id"], "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(100)
    viewer_id = viewer["id"] if viewer else None
    return [await enrich_video(v, viewer_id) for v in videos]

@api_router.get("/videos/stream/{video_id}")
async def stream_video(video_id: str):
    v = await db.videos.find_one({"id": video_id, "is_deleted": False})
    if not v:
        raise HTTPException(404, "الفيديو غير موجود")
    data, ct = get_object(v["storage_path"])
    return Response(content=data, media_type=v.get("content_type", ct))

@api_router.post("/videos/{video_id}/like")
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

@api_router.post("/videos/{video_id}/view")
async def view_video(video_id: str):
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    return {"ok": True}


# ==================== COMMENTS ====================
@api_router.get("/videos/{video_id}/comments")
async def get_comments(video_id: str):
    comments = await db.comments.find({"video_id": video_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for c in comments:
        u = await db.users.find_one({"id": c["user_id"]}, {"_id": 0, "password": 0})
        c["user"] = u
    return comments

@api_router.post("/videos/{video_id}/comments")
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


# ==================== SERVICES ====================
@api_router.post("/services")
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

@api_router.get("/services/user/{username}")
async def user_services(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    services = await db.services.find({"user_id": user["id"], "is_active": True}, {"_id": 0}).to_list(100)
    return services

@api_router.get("/services/{service_id}")
async def get_service(service_id: str):
    s = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "الخدمة غير موجودة")
    u = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "password": 0})
    s["creator"] = u
    return s

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user=Depends(current_user)):
    s = await db.services.find_one({"id": service_id})
    if not s or s["user_id"] != user["id"]:
        raise HTTPException(404, "الخدمة غير موجودة")
    await db.services.update_one({"id": service_id}, {"$set": {"is_active": False}})
    return {"ok": True}


# ==================== ORDERS ====================
@api_router.post("/orders")
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
        "status": "pending_payment",  # pending_payment -> paid -> delivered -> completed
        "payment_status": "unpaid",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    doc["service"] = {k: v for k, v in service.items() if k != "_id"}
    # Notify creator
    await create_notification(service["user_id"], "order", f"@{user['username']} طلب خدمة: {service['title']}", order_id, user["id"])
    return doc

@api_router.get("/orders/my")
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

@api_router.get("/orders/reviewed-ids")
async def reviewed_order_ids(user=Depends(current_user)):
    reviews = await db.reviews.find({"client_id": user["id"]}, {"_id": 0, "order_id": 1}).to_list(1000)
    return [r["order_id"] for r in reviews]

@api_router.post("/orders/{order_id}/deliver")
async def mark_delivered(order_id: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["creator_id"] != user["id"]:
        raise HTTPException(404, "الطلب غير موجود")
    if o["payment_status"] != "paid":
        raise HTTPException(400, "لم يتم دفع الطلب بعد")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "delivered"}})
    await create_notification(o["client_id"], "delivery", "تم تسليم طلبك ✓", order_id, user["id"])
    return {"ok": True}


# ==================== STRIPE PAYMENTS ====================
@api_router.post("/payments/checkout")
async def create_checkout(data: CheckoutRequest, request: Request, user=Depends(current_user)):
    order = await db.orders.find_one({"id": data.order_id})
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    if order["client_id"] != user["id"]:
        raise HTTPException(403, "غير مسموح")
    if order["payment_status"] == "paid":
        raise HTTPException(400, "تم الدفع مسبقاً")
    amount = float(order["amount"])
    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/orders?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/orders"
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {"order_id": data.order_id, "user_id": user["id"]}
    req = CheckoutSessionRequest(
        amount=amount, currency="usd",
        success_url=success_url, cancel_url=cancel_url, metadata=metadata,
    )
    session: CheckoutSessionResponse = await checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "order_id": data.order_id,
        "user_id": user["id"],
        "amount": amount,
        "currency": "usd",
        "metadata": metadata,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(404, "غير موجود")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)
    # Update if not already processed
    if tx["payment_status"] != "paid" and status.payment_status == "paid":
        amount = float(tx["amount"])
        platform_fee = round(amount * PLATFORM_FEE_PERCENT / 100.0, 2)
        creator_earnings = round(amount - platform_fee, 2)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": status.status,
                      "platform_fee": platform_fee, "creator_earnings": creator_earnings}}
        )
        order = await db.orders.find_one({"id": tx["order_id"]})
        await db.orders.update_one(
            {"id": tx["order_id"]},
            {"$set": {"payment_status": "paid", "status": "paid",
                      "platform_fee": platform_fee, "creator_earnings": creator_earnings}}
        )
        if order:
            await create_notification(order["creator_id"], "payment", f"تم دفع طلبك (+${creator_earnings})", order["id"], order["client_id"])
    else:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status.status, "payment_status": status.payment_status}}
        )
    return {"status": status.status, "payment_status": status.payment_status, "amount": status.amount_total, "currency": status.currency}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await checkout.handle_webhook(body, sig)
        if event.payment_status == "paid":
            tx = await db.payment_transactions.find_one({"session_id": event.session_id})
            if tx and tx["payment_status"] != "paid":
                amount = float(tx["amount"])
                platform_fee = round(amount * PLATFORM_FEE_PERCENT / 100.0, 2)
                creator_earnings = round(amount - platform_fee, 2)
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "paid", "status": "complete",
                              "platform_fee": platform_fee, "creator_earnings": creator_earnings}}
                )
                await db.orders.update_one(
                    {"id": tx["order_id"]},
                    {"$set": {"payment_status": "paid", "status": "paid",
                              "platform_fee": platform_fee, "creator_earnings": creator_earnings}}
                )
    except Exception as e:
        logging.error(f"Webhook error: {e}")
    return {"ok": True}


# ==================== EXPLORE / SEARCH ====================
@api_router.get("/explore/creators")
async def explore_creators(limit: int = 20):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("followers", -1).to_list(limit)
    return users

@api_router.get("/search")
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


# ==================== REVIEWS ====================
@api_router.post("/reviews")
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

@api_router.get("/reviews/service/{service_id}")
async def service_reviews(service_id: str):
    reviews = await db.reviews.find({"service_id": service_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reviews:
        r["client"] = await db.users.find_one({"id": r["client_id"]}, {"_id": 0, "password": 0})
    avg = 0
    if reviews:
        avg = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
    return {"reviews": reviews, "average": avg, "count": len(reviews)}


# ==================== NOTIFICATIONS ====================
@api_router.get("/notifications")
async def get_notifications(user=Depends(current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for n in items:
        if n.get("from_user_id"):
            n["from_user"] = await db.users.find_one({"id": n["from_user_id"]}, {"_id": 0, "password": 0})
    unseen = await db.notifications.count_documents({"user_id": user["id"], "seen": False})
    return {"items": items, "unseen": unseen}

@api_router.post("/notifications/mark-seen")
async def mark_seen(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "seen": False}, {"$set": {"seen": True}})
    return {"ok": True}


# ==================== MESSAGES ====================
def _conv_id(a: str, b: str) -> str:
    return "_".join(sorted([a, b]))

@api_router.get("/messages/conversations")
async def conversations(user=Depends(current_user)):
    # Get last message per conversation for this user
    pipeline = [
        {"$match": {"$or": [{"sender_id": user["id"]}, {"receiver_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$conv_id", "last": {"$first": "$$ROOT"}}},
        {"$sort": {"last.created_at": -1}},
    ]
    convs = await db.messages.aggregate(pipeline).to_list(200)
    result = []
    for c in convs:
        last = c["last"]
        other_id = last["receiver_id"] if last["sender_id"] == user["id"] else last["sender_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        unread = await db.messages.count_documents({
            "conv_id": last["conv_id"], "receiver_id": user["id"], "seen": False
        })
        result.append({
            "conv_id": last["conv_id"],
            "user": other,
            "last_text": last["text"],
            "last_at": last["created_at"],
            "unread": unread,
        })
    return result

@api_router.get("/messages/with/{username}")
async def messages_with(username: str, user=Depends(current_user)):
    other = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not other:
        raise HTTPException(404, "المستخدم غير موجود")
    conv = _conv_id(user["id"], other["id"])
    msgs = await db.messages.find({"conv_id": conv}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.messages.update_many(
        {"conv_id": conv, "receiver_id": user["id"], "seen": False},
        {"$set": {"seen": True}}
    )
    return {"user": other, "messages": msgs}

@api_router.post("/messages/with/{username}")
async def send_message(username: str, data: MessageCreate, user=Depends(current_user)):
    other = await db.users.find_one({"username": username})
    if not other:
        raise HTTPException(404, "المستخدم غير موجود")
    if other["id"] == user["id"]:
        raise HTTPException(400, "لا يمكن مراسلة نفسك")
    conv = _conv_id(user["id"], other["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "conv_id": conv,
        "sender_id": user["id"],
        "receiver_id": other["id"],
        "text": data.text,
        "seen": False,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    await create_notification(other["id"], "message", f"@{user['username']} أرسل لك رسالة", user["username"], user["id"])
    return doc


# ==================== EARNINGS ====================
@api_router.get("/earnings/me")
async def my_earnings(user=Depends(current_user)):
    paid_orders = await db.orders.find({"creator_id": user["id"], "payment_status": "paid"}, {"_id": 0}).to_list(1000)
    total_earned = sum(float(o.get("creator_earnings", 0)) for o in paid_orders)
    total_gross = sum(float(o.get("amount", 0)) for o in paid_orders)
    total_fees = sum(float(o.get("platform_fee", 0)) for o in paid_orders)
    return {
        "total_gross": round(total_gross, 2),
        "total_fees": round(total_fees, 2),
        "total_earned": round(total_earned, 2),
        "orders_count": len(paid_orders),
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
    }


# ==================== APP SETUP ====================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
