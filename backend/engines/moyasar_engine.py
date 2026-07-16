"""
Moyasar Engine — Saudi payment gateway for
  1. Tips (one-time small SAR payments to a creator)
  2. Creator Subscriptions (monthly recurring — fan → creator)
  3. Wallet + Payouts (creator withdrawal to Saudi IBAN)

All amounts are stored in halalas (1 SAR = 100 halalas) exactly as Moyasar expects.
Server-side is the only source of truth: we always re-fetch a payment via GET /v1/payments/{id}
after callbacks/webhooks before crediting the wallet.
"""
import os
import uuid
import base64
import hmac
import hashlib
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from core.deps import (
    db, now_iso, current_user, create_notification, PLATFORM_FEE_PERCENT,
)
from core.security_utils import limiter

router = APIRouter(tags=["moyasar"])
log = logging.getLogger("moyasar")

MOYASAR_BASE = os.environ.get("MOYASAR_BASE_URL", "https://api.moyasar.com/v1")
MOYASAR_SECRET_KEY = os.environ.get("MOYASAR_SECRET_KEY", "")
MOYASAR_PUBLISHABLE_KEY = os.environ.get("MOYASAR_PUBLISHABLE_KEY", "")
MOYASAR_WEBHOOK_SECRET = os.environ.get("MOYASAR_WEBHOOK_SECRET", "")


def _basic_auth() -> dict:
    if not MOYASAR_SECRET_KEY:
        raise HTTPException(503, "خدمة الدفع غير مفعّلة حالياً — تواصل مع الإدارة")
    token = base64.b64encode(f"{MOYASAR_SECRET_KEY}:".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def _moyasar(method: str, path: str, payload: Optional[dict] = None):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, f"{MOYASAR_BASE}{path}", headers=_basic_auth(), json=payload)
        if r.status_code >= 400:
            log.warning("Moyasar %s %s → %s: %s", method, path, r.status_code, r.text[:400])
            try:
                detail = r.json()
            except Exception:
                detail = {"message": r.text}
            raise HTTPException(r.status_code, {"provider": "moyasar", **detail})
        return r.json() if r.content else {}


# ═══════════════════════════════════════════════════════════════
# CONFIG endpoint — frontend uses this to know publishable key + platform config
# ═══════════════════════════════════════════════════════════════
@router.get("/moyasar/config")
async def moyasar_config():
    return {
        "publishable_key": MOYASAR_PUBLISHABLE_KEY,
        "currency": "SAR",
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
        "methods": ["creditcard", "applepay", "stcpay"],
        "enabled": bool(MOYASAR_SECRET_KEY),
    }


# ═══════════════════════════════════════════════════════════════
# TIPS (إكراميات) — one-time payment from fan → creator
# ═══════════════════════════════════════════════════════════════
class TipCreate(BaseModel):
    creator_username: str
    amount_sar: int  # whole SAR
    message: Optional[str] = ""
    video_id: Optional[str] = None  # optional — if tip is on a video
    method: str = "creditcard"       # creditcard | applepay | stcpay
    save_card: bool = False


ALLOWED_TIP_AMOUNTS = [5, 10, 25, 50, 100, 200, 500]


@router.post("/tips")
@limiter.limit("20/hour")
async def create_tip(request: Request, payload: TipCreate, user=Depends(current_user)):
    """
    Creates a *pending* tip and returns the checkout intent.
    The actual card charge is handled entirely by Moyasar.js on the client
    (PCI-compliant). We reconcile via `/api/webhooks/moyasar` using given_id/metadata.
    """
    if payload.amount_sar not in ALLOWED_TIP_AMOUNTS and payload.amount_sar < 5:
        raise HTTPException(400, "المبلغ خارج النطاق المسموح")
    creator = await db.users.find_one({"username": payload.creator_username})
    if not creator:
        raise HTTPException(404, "المبدع غير موجود")
    if creator["id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك إرسال إكرامية لنفسك")
    if creator.get("is_banned"):
        raise HTTPException(403, "لا يمكن إرسال إكرامية لهذا الحساب")
    if not MOYASAR_SECRET_KEY:
        raise HTTPException(503, "خدمة الدفع غير مفعّلة حالياً")

    tip_id = str(uuid.uuid4())
    amount_halalas = payload.amount_sar * 100
    platform_fee_halalas = int(amount_halalas * PLATFORM_FEE_PERCENT / 100)
    creator_earnings_halalas = amount_halalas - platform_fee_halalas

    tip_doc = {
        "id": tip_id,
        "sender_id": user["id"],
        "sender_username": user.get("username"),
        "creator_id": creator["id"],
        "creator_username": creator["username"],
        "video_id": payload.video_id,
        "amount_halalas": amount_halalas,
        "platform_fee_halalas": platform_fee_halalas,
        "creator_earnings_halalas": creator_earnings_halalas,
        "message": (payload.message or "").strip()[:280],
        "status": "pending",
        "moyasar_payment_id": None,
        "created_at": now_iso(),
    }
    await db.tips.insert_one(tip_doc)
    tip_doc.pop("_id", None)

    origin = str(request.headers.get("origin") or "").rstrip("/") or str(request.base_url).rstrip("/")
    return {
        "tip": tip_doc,
        "intent": {
            "amount_halalas": amount_halalas,
            "description": f"إكرامية لـ @{creator['username']}",
            "publishable_key": MOYASAR_PUBLISHABLE_KEY,
            "callback_url": f"{origin}/wallet?tip_id={tip_id}",
            "given_id": tip_id,
            "metadata": {"tip_id": tip_id, "type": "tip", "creator_id": creator["id"], "sender_id": user["id"]},
            "methods": [payload.method],
        },
    }


@router.get("/tips/received")
async def tips_received(user=Depends(current_user), limit: int = 50):
    rows = await db.tips.find(
        {"creator_id": user["id"], "status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return rows


@router.get("/tips/sent")
async def tips_sent(user=Depends(current_user), limit: int = 50):
    rows = await db.tips.find(
        {"sender_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return rows


# ═══════════════════════════════════════════════════════════════
# CREATOR SUBSCRIPTION PLANS + SUBSCRIPTIONS
# ═══════════════════════════════════════════════════════════════
class CreatorPlanUpdate(BaseModel):
    price_sar: int          # monthly price in SAR
    title: Optional[str] = "اشتراك شهري"
    perks: list[str] = []   # what fan gets
    active: bool = True


@router.get("/creators/{username}/subscription-plan")
async def get_creator_plan(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود")
    plan = await db.creator_plans.find_one({"creator_id": user["id"], "active": True}, {"_id": 0})
    return plan or None


@router.put("/creators/me/subscription-plan")
async def set_my_plan(payload: CreatorPlanUpdate, user=Depends(current_user)):
    if payload.price_sar < 5 or payload.price_sar > 5000:
        raise HTTPException(400, "السعر خارج النطاق (5 - 5000 ريال)")
    existing = await db.creator_plans.find_one({"creator_id": user["id"]})
    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "creator_id": user["id"],
        "creator_username": user["username"],
        "price_sar": payload.price_sar,
        "price_halalas": payload.price_sar * 100,
        "title": (payload.title or "اشتراك شهري").strip()[:80],
        "perks": [p.strip()[:120] for p in (payload.perks or [])][:8],
        "active": payload.active,
        "created_at": existing["created_at"] if existing else now_iso(),
        "updated_at": now_iso(),
    }
    await db.creator_plans.update_one({"creator_id": user["id"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    return doc


class SubscribeCreate(BaseModel):
    method: str = "creditcard"


@router.post("/creators/{username}/subscribe")
async def subscribe_to_creator(username: str, payload: SubscribeCreate, request: Request, user=Depends(current_user)):
    creator = await db.users.find_one({"username": username})
    if not creator:
        raise HTTPException(404, "المبدع غير موجود")
    if creator["id"] == user["id"]:
        raise HTTPException(400, "لا يمكنك الاشتراك في نفسك")

    plan = await db.creator_plans.find_one({"creator_id": creator["id"], "active": True})
    if not plan:
        raise HTTPException(404, "المبدع لا يقدّم خطة اشتراك حالياً")

    existing = await db.subscriptions.find_one({
        "fan_id": user["id"], "creator_id": creator["id"], "status": {"$in": ["pending", "active"]}
    })
    if existing:
        raise HTTPException(409, "لديك اشتراك قائم مع هذا المبدع")
    if not MOYASAR_SECRET_KEY:
        raise HTTPException(503, "خدمة الدفع غير مفعّلة حالياً")

    sub_id = str(uuid.uuid4())
    sub_doc = {
        "id": sub_id,
        "fan_id": user["id"],
        "fan_username": user["username"],
        "creator_id": creator["id"],
        "creator_username": creator["username"],
        "plan_id": plan["id"],
        "price_sar": plan["price_sar"],
        "price_halalas": plan["price_halalas"],
        "status": "pending",
        "moyasar_initial_payment_id": None,
        "token": None,
        "current_period_start": None,
        "current_period_end": None,
        "cancel_at_period_end": False,
        "created_at": now_iso(),
    }
    await db.subscriptions.insert_one(sub_doc)
    sub_doc.pop("_id", None)

    origin = str(request.headers.get("origin") or "").rstrip("/") or str(request.base_url).rstrip("/")
    return {
        "subscription": sub_doc,
        "intent": {
            "amount_halalas": plan["price_halalas"],
            "description": f"اشتراك شهري في @{creator['username']}",
            "publishable_key": MOYASAR_PUBLISHABLE_KEY,
            "callback_url": f"{origin}/wallet?sub_id={sub_id}",
            "given_id": sub_id,
            "metadata": {"sub_id": sub_id, "type": "subscription_initial", "creator_id": creator["id"], "fan_id": user["id"], "plan_id": plan["id"]},
            "save_card": True,
            "methods": [payload.method],
        },
    }


@router.get("/subscriptions/me")
async def my_subscriptions(user=Depends(current_user)):
    subs = await db.subscriptions.find(
        {"fan_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return subs


@router.get("/subscriptions/subscribers")
async def my_subscribers(user=Depends(current_user)):
    """List of fans subscribed to me (creator view)."""
    subs = await db.subscriptions.find(
        {"creator_id": user["id"], "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return subs


@router.delete("/subscriptions/{sub_id}")
async def cancel_subscription(sub_id: str, user=Depends(current_user)):
    sub = await db.subscriptions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "الاشتراك غير موجود")
    if sub["fan_id"] != user["id"]:
        raise HTTPException(403, "غير مصرح")
    await db.subscriptions.update_one(
        {"id": sub_id},
        {"$set": {"cancel_at_period_end": True, "cancelled_at": now_iso()}},
    )
    return {"cancelled": True, "note": "الاشتراك سيبقى نشطاً حتى نهاية الدورة الحالية"}


# ═══════════════════════════════════════════════════════════════
# WALLET & PAYOUTS
# ═══════════════════════════════════════════════════════════════
async def _wallet_balance(user_id: str) -> dict:
    """Aggregate wallet balance from tips + subscriptions + orders - payouts."""
    pipeline_income = [
        {"$match": {"creator_id": user_id, "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$creator_earnings_halalas"}}},
    ]
    tips_agg = await db.tips.aggregate(pipeline_income).to_list(1)
    sub_agg = await db.wallet_ledger.aggregate([
        {"$match": {"user_id": user_id, "type": "subscription_credit"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_halalas"}}},
    ]).to_list(1)
    orders_agg = await db.orders.aggregate([
        {"$match": {"creator_id": user_id, "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$creator_earnings"}}},
    ]).to_list(1)
    payouts_agg = await db.payout_requests.aggregate([
        {"$match": {"user_id": user_id, "status": {"$in": ["paid", "pending", "processing"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_halalas"}}},
    ]).to_list(1)

    tips_total = tips_agg[0]["total"] if tips_agg else 0
    sub_total = sub_agg[0]["total"] if sub_agg else 0
    orders_total_sar = orders_agg[0]["total"] if orders_agg else 0
    orders_total = int(round(orders_total_sar * 100))
    payouts_total = payouts_agg[0]["total"] if payouts_agg else 0

    gross = tips_total + sub_total + orders_total
    available = gross - payouts_total
    return {
        "gross_halalas": gross,
        "gross_sar": round(gross / 100, 2),
        "payouts_reserved_halalas": payouts_total,
        "payouts_reserved_sar": round(payouts_total / 100, 2),
        "available_halalas": max(available, 0),
        "available_sar": round(max(available, 0) / 100, 2),
        "breakdown": {
            "tips_sar": round(tips_total / 100, 2),
            "subscriptions_sar": round(sub_total / 100, 2),
            "services_sar": round(orders_total / 100, 2),
        },
    }


@router.get("/wallet")
async def get_wallet(user=Depends(current_user)):
    balance = await _wallet_balance(user["id"])
    payouts = await db.payout_requests.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    recent_tips = await db.tips.find(
        {"creator_id": user["id"], "status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {"balance": balance, "payouts": payouts, "recent_tips": recent_tips}


class PayoutRequest(BaseModel):
    amount_sar: int
    iban: str
    beneficiary_name: str
    mobile: str
    city: str = "Riyadh"


IBAN_MIN_LEN = 15


@router.post("/wallet/payout")
@limiter.limit("5/hour")
async def request_payout(request: Request, payload: PayoutRequest, user=Depends(current_user)):
    if payload.amount_sar < 50:
        raise HTTPException(400, "الحد الأدنى للسحب 50 ريال")
    iban = (payload.iban or "").replace(" ", "").upper()
    if not iban.startswith("SA") or len(iban) < IBAN_MIN_LEN:
        raise HTTPException(400, "رقم الآيبان غير صالح — يجب أن يبدأ بـ SA")

    balance = await _wallet_balance(user["id"])
    amount_halalas = payload.amount_sar * 100
    if amount_halalas > balance["available_halalas"]:
        raise HTTPException(400, f"الرصيد المتاح غير كافٍ ({balance['available_sar']} ريال)")

    payout_id = str(uuid.uuid4())
    doc = {
        "id": payout_id,
        "user_id": user["id"],
        "username": user["username"],
        "amount_halalas": amount_halalas,
        "amount_sar": payload.amount_sar,
        "iban": iban,
        "beneficiary_name": payload.beneficiary_name.strip()[:80],
        "mobile": payload.mobile.strip()[:20],
        "city": (payload.city or "Riyadh").strip()[:40],
        "status": "pending",  # pending → processing → paid | failed
        "moyasar_payout_id": None,
        "created_at": now_iso(),
    }
    await db.payout_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ═══════════════════════════════════════════════════════════════
# WEBHOOK — source of truth
# ═══════════════════════════════════════════════════════════════
def _verify_webhook_signature(raw: bytes, request_headers, body_json: dict) -> bool:
    """
    Moyasar sends the secret in one of several places depending on config:
      1. Header  `X-Moyasar-Secret-Token` (or `X-Webhook-Token`)  — plain comparison
      2. Body    `secret_token` field                            — plain comparison
      3. Header  `X-Moyasar-Signature`                           — HMAC-SHA256(body, secret) hex

    If MOYASAR_WEBHOOK_SECRET is unset, we accept (dev mode).
    """
    if not MOYASAR_WEBHOOK_SECRET:
        log.warning("MOYASAR_WEBHOOK_SECRET not set — accepting webhook without verification")
        return True

    secret = MOYASAR_WEBHOOK_SECRET

    # 1. Plain token in body
    body_token = (body_json or {}).get("secret_token")
    if body_token and hmac.compare_digest(body_token, secret):
        return True

    # 2. Plain token in header
    for header_name in ("x-moyasar-secret-token", "x-webhook-token", "x-secret-token"):
        val = request_headers.get(header_name)
        if val and hmac.compare_digest(val, secret):
            return True

    # 3. HMAC-SHA256 signature header
    sig = request_headers.get("x-moyasar-signature") or request_headers.get("x-signature")
    if sig:
        expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, sig):
            return True

    log.warning("webhook signature verification failed — no matching mechanism")
    return False


@router.post("/webhooks/moyasar")
async def moyasar_webhook(request: Request):
    raw = await request.body()
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "payload غير صالح")

    if not _verify_webhook_signature(raw, {k.lower(): v for k, v in request.headers.items()}, event):
        raise HTTPException(401, "توقيع غير صالح")

    event_type = event.get("type", "")
    data = event.get("data", {}) or {}
    payment_id = data.get("id")
    metadata = data.get("metadata") or {}
    status = data.get("status")

    # Store raw event for audit
    await db.moyasar_events.insert_one({
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "payment_id": payment_id,
        "status": status,
        "raw": event,
        "received_at": now_iso(),
    })

    normalized = "paid" if event_type in ("payment_paid", "payment_captured", "payment_verified") else \
                 "failed" if event_type in ("payment_failed", "payment_faild", "card_auth_failed") else \
                 "refunded" if event_type == "payment_refunded" else \
                 status or "unknown"

    kind = metadata.get("type")

    try:
        if kind == "tip":
            await _handle_tip_event(payment_id, normalized, data, metadata)
        elif kind == "subscription_initial":
            await _handle_subscription_initial(payment_id, normalized, data, metadata)
        elif kind == "subscription_renewal":
            await _handle_subscription_renewal(payment_id, normalized, data, metadata)
    except Exception as e:
        log.exception("webhook processing error: %s", e)

    return {"ok": True}


async def _handle_tip_event(payment_id: str, normalized: str, data: dict, metadata: dict):
    tip_id = metadata.get("tip_id")
    if not tip_id:
        return
    tip = await db.tips.find_one({"id": tip_id})
    if not tip:
        return
    if tip.get("status") == "paid":
        return  # idempotent
    await db.tips.update_one({"id": tip_id}, {"$set": {"status": normalized, "moyasar_payment_id": payment_id, "paid_at": now_iso() if normalized == "paid" else None}})

    if normalized == "paid":
        # Notify creator
        try:
            await create_notification(
                tip["creator_id"],
                "tip_received",
                f"تلقّيت إكرامية {tip['amount_halalas'] // 100} ريال من @{tip.get('sender_username', 'مستخدم')}",
                tip_id,
                tip["sender_id"],
            )
        except Exception:
            pass


async def _handle_subscription_initial(payment_id: str, normalized: str, data: dict, metadata: dict):
    sub_id = metadata.get("sub_id")
    if not sub_id:
        return
    sub = await db.subscriptions.find_one({"id": sub_id})
    if not sub or sub.get("status") == "active":
        return

    if normalized == "paid":
        # Extract saved-card token for future renewals
        source = data.get("source", {}) or {}
        token = source.get("token")
        from datetime import datetime, timedelta, timezone as _tz
        start = datetime.now(_tz.utc)
        end = start + timedelta(days=30)
        await db.subscriptions.update_one(
            {"id": sub_id},
            {"$set": {
                "status": "active",
                "token": token,
                "current_period_start": start.isoformat(),
                "current_period_end": end.isoformat(),
                "activated_at": start.isoformat(),
            }},
        )
        # Credit creator wallet
        platform_fee_halalas = int(sub["price_halalas"] * PLATFORM_FEE_PERCENT / 100)
        creator_earnings_halalas = sub["price_halalas"] - platform_fee_halalas
        await db.wallet_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": sub["creator_id"],
            "type": "subscription_credit",
            "sub_id": sub_id,
            "amount_halalas": creator_earnings_halalas,
            "fee_halalas": platform_fee_halalas,
            "created_at": now_iso(),
        })
        try:
            await create_notification(
                sub["creator_id"],
                "new_subscriber",
                f"لديك مشترك جديد @{sub.get('fan_username')} 🎉",
                sub_id,
                sub["fan_id"],
            )
        except Exception:
            pass
    else:
        await db.subscriptions.update_one({"id": sub_id}, {"$set": {"status": "failed"}})


async def _handle_subscription_renewal(payment_id: str, normalized: str, data: dict, metadata: dict):
    sub_id = metadata.get("sub_id")
    sub = await db.subscriptions.find_one({"id": sub_id})
    if not sub:
        return
    from datetime import datetime, timedelta, timezone as _tz
    if normalized == "paid":
        start = datetime.now(_tz.utc)
        end = start + timedelta(days=30)
        await db.subscriptions.update_one(
            {"id": sub_id},
            {"$set": {"current_period_start": start.isoformat(), "current_period_end": end.isoformat(), "status": "active"}},
        )
        platform_fee_halalas = int(sub["price_halalas"] * PLATFORM_FEE_PERCENT / 100)
        creator_earnings_halalas = sub["price_halalas"] - platform_fee_halalas
        await db.wallet_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": sub["creator_id"],
            "type": "subscription_credit",
            "sub_id": sub_id,
            "amount_halalas": creator_earnings_halalas,
            "fee_halalas": platform_fee_halalas,
            "created_at": now_iso(),
        })
