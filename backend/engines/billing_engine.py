"""Billing Engine — Pro/Business plans, Stripe upgrade, AI credit metering."""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.deps import db, current_user, now_iso, STRIPE_API_KEY, create_notification

router = APIRouter(tags=["billing"])
logger = logging.getLogger("ruaa.billing")


# ==================== PLANS ====================
PLANS = {
    "free": {
        "key": "free",
        "name": "المجاني",
        "price_usd": 0,
        "ai_credits_monthly": 30,
        "features": ["إدارة CRM أساسية", "مهام و محتوى بدون حدود", "30 استخدام AI شهرياً"],
    },
    "pro": {
        "key": "pro",
        "name": "Pro",
        "price_usd": 19.00,
        "ai_credits_monthly": 500,
        "features": [
            "كل مزايا المجاني",
            "500 استخدام AI شهرياً",
            "فواتير غير محدودة",
            "عقود PDF بلا حدود",
            "أولوية في الدعم",
        ],
    },
    "business": {
        "key": "business",
        "name": "Business",
        "price_usd": 49.00,
        "ai_credits_monthly": 3000,
        "features": [
            "كل مزايا Pro",
            "3000 استخدام AI شهرياً",
            "فرق عمل غير محدودة",
            "علامة تجارية مخصصة على الفواتير والعقود",
            "دعم مباشر عبر البريد",
        ],
    },
}


class UpgradeRequest(BaseModel):
    plan: str  # 'pro' or 'business'
    origin_url: str


# ==================== HELPERS ====================
def _plan_of(user: dict) -> dict:
    key = (user or {}).get("plan") or "free"
    if key not in PLANS:
        key = "free"
    # check expiry
    exp = (user or {}).get("plan_expires_at")
    if key != "free" and exp:
        try:
            if datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                key = "free"
        except Exception:
            pass
    return PLANS[key]


async def _usage_this_month(uid: str) -> int:
    ym = datetime.now(timezone.utc).strftime("%Y-%m")
    doc = await db.ai_usage.find_one({"user_id": uid, "month": ym}, {"_id": 0, "count": 1})
    return int((doc or {}).get("count", 0))


async def consume_credit(uid: str, cost: int = 1) -> bool:
    """Consume AI credits. Returns True if allowed, False if quota exceeded."""
    user = await db.users.find_one({"id": uid}, {"_id": 0, "plan": 1, "plan_expires_at": 1})
    plan = _plan_of(user or {})
    used = await _usage_this_month(uid)
    if used + cost > plan["ai_credits_monthly"]:
        return False
    ym = datetime.now(timezone.utc).strftime("%Y-%m")
    await db.ai_usage.update_one(
        {"user_id": uid, "month": ym},
        {"$inc": {"count": cost}, "$setOnInsert": {"user_id": uid, "month": ym, "created_at": now_iso()}},
        upsert=True,
    )
    return True


# ==================== ROUTES ====================
@router.get("/billing/plans")
async def list_plans():
    return list(PLANS.values())


@router.get("/billing/me")
async def my_billing(user=Depends(current_user)):
    plan = _plan_of(user)
    used = await _usage_this_month(user["id"])
    return {
        "plan": plan,
        "credits_used": used,
        "credits_remaining": max(0, plan["ai_credits_monthly"] - used),
        "credits_total": plan["ai_credits_monthly"],
        "expires_at": user.get("plan_expires_at"),
    }


@router.post("/billing/checkout")
async def create_billing_checkout(data: UpgradeRequest, request: Request, user=Depends(current_user)):
    if data.plan not in ("pro", "business"):
        raise HTTPException(400, "خطة غير صالحة")
    amount = float(PLANS[data.plan]["price_usd"])
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{data.origin_url.rstrip('/')}/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url.rstrip('/')}/pricing"
    req = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"source": "subscription", "plan": data.plan, "user_id": user["id"]},
    )
    session = await stripe_checkout.create_checkout_session(req)

    # log payment transaction (per playbook)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": session.session_id,
        "amount": amount,
        "currency": "usd",
        "metadata": {"source": "subscription", "plan": data.plan},
        "payment_status": "initiated",
        "status": "initiated",
        "created_at": now_iso(),
    })
    return {"url": session.url, "session_id": session.session_id}


@router.get("/billing/status/{session_id}")
async def billing_status(session_id: str, request: Request, user=Depends(current_user)):
    """Poll checkout status and activate plan on first success."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    status = await stripe_checkout.get_checkout_status(session_id)

    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]})
    if not txn:
        raise HTTPException(404, "Transaction not found")

    # idempotent: activate plan once
    if status.payment_status == "paid" and txn.get("payment_status") != "paid":
        plan = (status.metadata or {}).get("plan") or txn.get("metadata", {}).get("plan")
        if plan in ("pro", "business"):
            expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"plan": plan, "plan_expires_at": expires, "updated_at": now_iso()}},
            )
            await create_notification(user["id"], "billing", f"تم تفعيل خطة {PLANS[plan]['name']} حتى 30 يوماً 🎉", ref_id=session_id)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "completed", "completed_at": now_iso()}},
        )

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "amount": status.amount_total / 100 if status.amount_total else 0,
        "currency": status.currency,
    }
