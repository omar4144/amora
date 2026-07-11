"""Analytics Engine: placeholder for platform-wide KPIs (future iteration)."""
from fastapi import APIRouter

from core.deps import db

router = APIRouter(tags=["analytics"])


@router.get("/analytics/platform")
async def platform_stats():
    users_count = await db.users.count_documents({})
    videos_count = await db.videos.count_documents({"is_deleted": False})
    services_count = await db.services.count_documents({"is_active": True})
    orders_count = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"payment_status": "paid"})
    communities_count = await db.communities.count_documents({})
    teams_count = await db.teams.count_documents({})
    ideas_count = await db.ideas.count_documents({})
    leads_count = await db.leads.count_documents({})
    return {
        "users": users_count,
        "videos": videos_count,
        "services": services_count,
        "orders": orders_count,
        "paid_orders": paid_orders,
        "communities": communities_count,
        "teams": teams_count,
        "ideas": ideas_count,
        "leads": leads_count,
    }
