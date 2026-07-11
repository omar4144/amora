"""Booking Engine: placeholder for Digital Twin (physical HQ room bookings + QR entry) — future iteration."""
from fastapi import APIRouter

router = APIRouter(tags=["booking"])


@router.get("/booking/ping")
async def booking_ping():
    return {"engine": "booking", "status": "placeholder", "planned": ["room-list", "booking", "qr-entry", "stripe-payment"]}
