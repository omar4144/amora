"""Payment Engine: Stripe checkout, status, webhook, earnings."""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest,
)

from core.deps import db, now_iso, current_user, create_notification, STRIPE_API_KEY, PLATFORM_FEE_PERCENT
from core.schemas import CheckoutRequest

router = APIRouter(tags=["payment"])


@router.post("/payments/checkout")
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


@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(404, "غير موجود")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)
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


@router.post("/webhook/stripe")
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


@router.get("/earnings/me")
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
