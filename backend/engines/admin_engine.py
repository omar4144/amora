"""
Admin Engine — RBAC-gated user management + platform admin dashboard.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from core.deps import db, now_iso, current_user
from core.rbac import ROLES, ROLE_KEYS, has_capability, require_capability, role_meta

router = APIRouter(tags=["admin"])


class RoleUpdate(BaseModel):
    role: str


class BanUpdate(BaseModel):
    banned: bool
    reason: Optional[str] = ""


# ═══════════════════════════════════════════════════════════════
# META
# ═══════════════════════════════════════════════════════════════
@router.get("/admin/roles")
async def list_roles():
    """Public: list all available roles (for UI selectors)."""
    return ROLES


@router.get("/admin/me/permissions")
async def my_permissions(user=Depends(current_user)):
    """Return current user's role + their allowed capabilities."""
    from core.rbac import CAPABILITIES
    role = user.get("role", "creator")
    caps = []
    for cap_key, allowed in CAPABILITIES.items():
        if allowed == "*" or role in allowed:
            caps.append(cap_key)
    return {"role": role, "role_meta": role_meta(role), "capabilities": caps}


# ═══════════════════════════════════════════════════════════════
# USERS MANAGEMENT (admin only)
# ═══════════════════════════════════════════════════════════════
@router.get("/admin/users")
async def list_users(
    user=Depends(require_capability("admin.view_all_users")),
    role: Optional[str] = None,
    banned: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = 200,
):
    query = {}
    if role:
        query["role"] = role
    if banned is not None:
        query["is_banned"] = banned
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(limit)
    for u in users:
        u["role_meta"] = role_meta(u.get("role", "creator"))
    return users


@router.get("/admin/users/{user_id}")
async def get_user_admin(user_id: str, admin=Depends(require_capability("admin.view_all_users"))):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")
    u["role_meta"] = role_meta(u.get("role", "creator"))
    # counts
    u["stats"] = {
        "videos": await db.videos.count_documents({"user_id": user_id, "is_deleted": False}),
        "services": await db.services.count_documents({"user_id": user_id, "is_active": True}),
        "orders_placed": await db.orders.count_documents({"client_id": user_id}),
        "orders_received": await db.orders.count_documents({"creator_id": user_id}),
    }
    return u


@router.put("/admin/users/{user_id}/role")
async def change_role(
    user_id: str,
    payload: RoleUpdate,
    admin=Depends(require_capability("admin.change_user_role")),
):
    if payload.role not in ROLE_KEYS:
        raise HTTPException(400, "دور غير صحيح")
    if user_id == admin["id"] and payload.role != "super_admin":
        raise HTTPException(400, "لا يمكنك تغيير دورك من super_admin")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": payload.role, "role_changed_at": now_iso(), "role_changed_by": admin["id"]}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "المستخدم غير موجود")
    # audit log
    await db.admin_audit.insert_one({
        "id": __import__("uuid").uuid4().hex,
        "actor_id": admin["id"],
        "target_id": user_id,
        "action": "change_role",
        "meta": {"new_role": payload.role},
        "created_at": now_iso(),
    })
    return {"ok": True, "new_role": payload.role}


@router.put("/admin/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    payload: BanUpdate,
    admin=Depends(require_capability("admin.ban_users")),
):
    if user_id == admin["id"]:
        raise HTTPException(400, "لا يمكنك حظر نفسك")
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_banned": bool(payload.banned),
            "banned_reason": payload.reason or "",
            "banned_at": now_iso() if payload.banned else None,
            "banned_by": admin["id"] if payload.banned else None,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "المستخدم غير موجود")
    await db.admin_audit.insert_one({
        "id": __import__("uuid").uuid4().hex,
        "actor_id": admin["id"],
        "target_id": user_id,
        "action": "ban" if payload.banned else "unban",
        "meta": {"reason": payload.reason},
        "created_at": now_iso(),
    })
    return {"ok": True, "banned": bool(payload.banned)}


# ═══════════════════════════════════════════════════════════════
# ADMIN DASHBOARD
# ═══════════════════════════════════════════════════════════════
@router.get("/admin/dashboard")
async def admin_dashboard(admin=Depends(require_capability("admin.view_platform_stats"))):
    """Full platform KPIs for admin dashboard."""
    users_total = await db.users.count_documents({})
    users_banned = await db.users.count_documents({"is_banned": True})
    videos_total = await db.videos.count_documents({"is_deleted": False})
    orders_total = await db.orders.count_documents({})
    orders_paid = await db.orders.count_documents({"payment_status": "paid"})
    services_total = await db.services.count_documents({"is_active": True})
    communities_total = await db.communities.count_documents({})
    teams_total = await db.teams.count_documents({})
    ideas_total = await db.ideas.count_documents({})
    leads_total = await db.leads.count_documents({})
    events_total = await db.events.count_documents({})
    courses_total = await db.courses.count_documents({})
    content_items = await db.content_items.count_documents({})
    crm_clients = await db.crm_clients.count_documents({})
    crm_deals = await db.crm_deals.count_documents({})
    tasks_total = await db.tasks.count_documents({})

    # revenue: sum of paid orders' amount
    paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "amount": 1, "platform_fee": 1}).to_list(5000)
    gross_revenue = sum(float(o.get("amount", 0)) for o in paid_orders)
    platform_fees = sum(float(o.get("platform_fee", 0)) for o in paid_orders)

    # users by role
    by_role = []
    for r in ROLES:
        c = await db.users.count_documents({"role": r["key"]})
        by_role.append({**r, "count": c})

    return {
        "users": {"total": users_total, "banned": users_banned, "by_role": by_role},
        "content": {"videos": videos_total, "content_items": content_items, "events": events_total, "courses": courses_total},
        "business": {
            "services": services_total, "orders_total": orders_total, "orders_paid": orders_paid,
            "gross_revenue": round(gross_revenue, 2), "platform_fees": round(platform_fees, 2),
            "crm_clients": crm_clients, "crm_deals": crm_deals, "tasks": tasks_total,
        },
        "community": {"communities": communities_total, "teams": teams_total, "ideas": ideas_total, "leads": leads_total},
    }


@router.get("/admin/audit")
async def audit_log(admin=Depends(require_capability("admin.view_platform_stats")), limit: int = 100):
    logs = await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for l in logs:
        actor = await db.users.find_one({"id": l["actor_id"]}, {"_id": 0, "username": 1, "name": 1})
        target = await db.users.find_one({"id": l["target_id"]}, {"_id": 0, "username": 1, "name": 1})
        l["actor"] = actor
        l["target"] = target
    return logs


# Backwards compat ping
@router.get("/admin/ping")
async def admin_ping():
    return {"engine": "admin", "status": "active", "version": "v1"}
