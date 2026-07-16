"""
CRM Engine — full CRM: Leads (landing form) + Clients + Deals (Kanban Pipeline)
+ Activities + Stats. User-scoped: each user manages their own book of business.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Request

from core.deps import db, now_iso, current_user, DEAL_STAGES, DEAL_STAGE_KEYS
from core.security_utils import limiter
from core.schemas import (
    LeadCreate, ClientCreate, ClientUpdate,
    DealCreate, DealUpdate, DealMove, ActivityCreate,
)

router = APIRouter(tags=["crm"])


# ═══════════════════════════════════════════════════════════════
# LEADS (Landing page form) — kept as-is
# ═══════════════════════════════════════════════════════════════
@router.post("/leads")
@limiter.limit("3/minute;20/hour")
async def create_lead(request: Request, payload: LeadCreate):
    lead = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email,
        "story": payload.story.strip(),
        "status": "new",
        "source": "landing",
        "created_at": now_iso(),
    }
    await db.leads.insert_one(lead)
    return {"success": True, "id": lead["id"]}


@router.get("/leads")
async def list_leads(user=Depends(current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="غير مصرح")
    leads = await db.leads.find().sort("created_at", -1).to_list(500)
    for l in leads:
        l.pop("_id", None)
    return leads


# ═══════════════════════════════════════════════════════════════
# CRM META
# ═══════════════════════════════════════════════════════════════
@router.get("/crm/stages")
async def get_stages():
    return DEAL_STAGES


# ═══════════════════════════════════════════════════════════════
# CLIENTS (per-user)
# ═══════════════════════════════════════════════════════════════
@router.get("/crm/clients")
async def list_clients(
    user=Depends(current_user),
    status: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
):
    query = {"owner_id": user["id"]}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
        ]
    clients = await db.crm_clients.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # attach deal count
    for c in clients:
        c["deals_count"] = await db.crm_deals.count_documents({"owner_id": user["id"], "client_id": c["id"]})
    return clients


@router.post("/crm/clients")
async def create_client(data: ClientCreate, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "name": data.name.strip(),
        "email": (data.email or "").strip(),
        "phone": (data.phone or "").strip(),
        "company": (data.company or "").strip(),
        "industry": (data.industry or "").strip(),
        "address": (data.address or "").strip(),
        "notes": data.notes or "",
        "tags": data.tags or [],
        "source": data.source or "manual",
        "status": data.status or "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.crm_clients.insert_one(doc)
    doc.pop("_id", None)
    doc["deals_count"] = 0
    return doc


@router.get("/crm/clients/{client_id}")
async def get_client(client_id: str, user=Depends(current_user)):
    c = await db.crm_clients.find_one({"id": client_id, "owner_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "العميل غير موجود")
    c["deals"] = await db.crm_deals.find({"owner_id": user["id"], "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    c["activities"] = await db.crm_activities.find({"owner_id": user["id"], "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return c


@router.put("/crm/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdate, user=Depends(current_user)):
    c = await db.crm_clients.find_one({"id": client_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "العميل غير موجود")
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    update["updated_at"] = now_iso()
    await db.crm_clients.update_one({"id": client_id, "owner_id": user["id"]}, {"$set": update})
    doc = await db.crm_clients.find_one({"id": client_id}, {"_id": 0})
    doc["deals_count"] = await db.crm_deals.count_documents({"owner_id": user["id"], "client_id": client_id})
    return doc


@router.delete("/crm/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(current_user)):
    c = await db.crm_clients.find_one({"id": client_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "العميل غير موجود")
    # cascade delete deals + activities
    await db.crm_deals.delete_many({"owner_id": user["id"], "client_id": client_id})
    await db.crm_activities.delete_many({"owner_id": user["id"], "client_id": client_id})
    await db.crm_clients.delete_one({"id": client_id, "owner_id": user["id"]})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# DEALS + Pipeline (per-user)
# ═══════════════════════════════════════════════════════════════
def _probability_for(stage: str) -> int:
    for s in DEAL_STAGES:
        if s["key"] == stage:
            return s["probability"]
    return 0


async def _enrich_deal(d: dict, owner_id: str) -> dict:
    d.pop("_id", None)
    if d.get("client_id"):
        client = await db.crm_clients.find_one({"id": d["client_id"], "owner_id": owner_id}, {"_id": 0})
        d["client"] = client
    return d


@router.get("/crm/deals")
async def list_deals(
    user=Depends(current_user),
    stage: Optional[str] = None,
    client_id: Optional[str] = None,
    limit: int = 500,
):
    query = {"owner_id": user["id"]}
    if stage:
        query["stage"] = stage
    if client_id:
        query["client_id"] = client_id
    deals = await db.crm_deals.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return [await _enrich_deal(d, user["id"]) for d in deals]


@router.get("/crm/deals/pipeline")
async def deals_pipeline(user=Depends(current_user)):
    """Kanban view: deals grouped by stage."""
    result = {}
    for stage in DEAL_STAGES:
        deals = await db.crm_deals.find(
            {"owner_id": user["id"], "stage": stage["key"]}, {"_id": 0}
        ).sort("updated_at", -1).to_list(200)
        enriched = [await _enrich_deal(d, user["id"]) for d in deals]
        total_value = sum(float(d.get("value", 0)) for d in enriched)
        result[stage["key"]] = {
            **stage,
            "deals": enriched,
            "count": len(enriched),
            "total_value": round(total_value, 2),
        }
    return result


@router.post("/crm/deals")
async def create_deal(data: DealCreate, user=Depends(current_user)):
    # validate client exists and is owned by user
    client = await db.crm_clients.find_one({"id": data.client_id, "owner_id": user["id"]})
    if not client:
        raise HTTPException(404, "العميل غير موجود")
    stage = data.stage or "new"
    if stage not in DEAL_STAGE_KEYS:
        raise HTTPException(400, "مرحلة غير صحيحة")
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": data.client_id,
        "title": data.title.strip(),
        "value": float(data.value or 0),
        "currency": data.currency or "USD",
        "stage": stage,
        "probability": _probability_for(stage),
        "expected_close_date": data.expected_close_date or "",
        "notes": data.notes or "",
        "tags": data.tags or [],
        "source_lead_id": data.source_lead_id,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "closed_at": now_iso() if stage in ("won", "lost") else None,
    }
    await db.crm_deals.insert_one(doc)
    # auto-log activity
    await db.crm_activities.insert_one({
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": data.client_id,
        "deal_id": doc["id"],
        "type": "note",
        "title": "تم إنشاء الصفقة",
        "description": f"تم إنشاء صفقة '{doc['title']}' بقيمة {doc['value']} {doc['currency']}",
        "date": now_iso(),
        "created_at": now_iso(),
    })
    return await _enrich_deal(dict(doc), user["id"])


@router.get("/crm/deals/{deal_id}")
async def get_deal(deal_id: str, user=Depends(current_user)):
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    d = await _enrich_deal(d, user["id"])
    d["activities"] = await db.crm_activities.find(
        {"owner_id": user["id"], "deal_id": deal_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return d


@router.put("/crm/deals/{deal_id}")
async def update_deal(deal_id: str, data: DealUpdate, user=Depends(current_user)):
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    update["updated_at"] = now_iso()
    await db.crm_deals.update_one({"id": deal_id, "owner_id": user["id"]}, {"$set": update})
    doc = await db.crm_deals.find_one({"id": deal_id}, {"_id": 0})
    return await _enrich_deal(doc, user["id"])


@router.put("/crm/deals/{deal_id}/stage")
async def move_deal_stage(deal_id: str, data: DealMove, user=Depends(current_user)):
    if data.stage not in DEAL_STAGE_KEYS:
        raise HTTPException(400, "مرحلة غير صحيحة")
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    old_stage = d["stage"]
    if old_stage == data.stage:
        return await _enrich_deal(d, user["id"])
    update = {
        "stage": data.stage,
        "probability": _probability_for(data.stage),
        "updated_at": now_iso(),
    }
    if data.stage in ("won", "lost"):
        update["closed_at"] = now_iso()
    elif old_stage in ("won", "lost"):
        update["closed_at"] = None
    await db.crm_deals.update_one({"id": deal_id, "owner_id": user["id"]}, {"$set": update})
    # log activity
    old_name = next((s["name"] for s in DEAL_STAGES if s["key"] == old_stage), old_stage)
    new_name = next((s["name"] for s in DEAL_STAGES if s["key"] == data.stage), data.stage)
    await db.crm_activities.insert_one({
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": d["client_id"],
        "deal_id": deal_id,
        "type": "stage_change",
        "title": f"نُقلت من '{old_name}' إلى '{new_name}'",
        "description": "",
        "date": now_iso(),
        "created_at": now_iso(),
    })
    doc = await db.crm_deals.find_one({"id": deal_id}, {"_id": 0})
    return await _enrich_deal(doc, user["id"])


@router.delete("/crm/deals/{deal_id}")
async def delete_deal(deal_id: str, user=Depends(current_user)):
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    await db.crm_activities.delete_many({"owner_id": user["id"], "deal_id": deal_id})
    await db.crm_deals.delete_one({"id": deal_id, "owner_id": user["id"]})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# ACTIVITIES (per-user)
# ═══════════════════════════════════════════════════════════════
@router.get("/crm/activities")
async def list_activities(
    user=Depends(current_user),
    client_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    limit: int = 200,
):
    query = {"owner_id": user["id"]}
    if client_id:
        query["client_id"] = client_id
    if deal_id:
        query["deal_id"] = deal_id
    items = await db.crm_activities.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # enrich with client/deal name for feed view
    for a in items:
        if a.get("client_id"):
            c = await db.crm_clients.find_one({"id": a["client_id"]}, {"_id": 0, "name": 1})
            a["client_name"] = c["name"] if c else None
        if a.get("deal_id"):
            d = await db.crm_deals.find_one({"id": a["deal_id"]}, {"_id": 0, "title": 1})
            a["deal_title"] = d["title"] if d else None
    return items


@router.post("/crm/activities")
async def create_activity(data: ActivityCreate, user=Depends(current_user)):
    if data.type not in ("note", "call", "email", "meeting", "task", "stage_change"):
        raise HTTPException(400, "نوع النشاط غير صحيح")
    if not data.client_id and not data.deal_id:
        raise HTTPException(400, "حدد العميل أو الصفقة")
    # validate ownership
    if data.client_id:
        c = await db.crm_clients.find_one({"id": data.client_id, "owner_id": user["id"]})
        if not c:
            raise HTTPException(404, "العميل غير موجود")
    if data.deal_id:
        d = await db.crm_deals.find_one({"id": data.deal_id, "owner_id": user["id"]})
        if not d:
            raise HTTPException(404, "الصفقة غير موجودة")
        # if activity has deal but no client, borrow client from deal
        if not data.client_id:
            data.client_id = d["client_id"]
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": data.client_id,
        "deal_id": data.deal_id,
        "type": data.type,
        "title": data.title.strip(),
        "description": data.description or "",
        "date": data.date or now_iso(),
        "created_at": now_iso(),
    }
    await db.crm_activities.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/crm/activities/{activity_id}")
async def delete_activity(activity_id: str, user=Depends(current_user)):
    a = await db.crm_activities.find_one({"id": activity_id, "owner_id": user["id"]})
    if not a:
        raise HTTPException(404, "النشاط غير موجود")
    await db.crm_activities.delete_one({"id": activity_id, "owner_id": user["id"]})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# STATS / DASHBOARD (per-user)
# ═══════════════════════════════════════════════════════════════
@router.get("/crm/stats")
async def crm_stats(user=Depends(current_user)):
    owner_id = user["id"]
    clients_total = await db.crm_clients.count_documents({"owner_id": owner_id})
    clients_active = await db.crm_clients.count_documents({"owner_id": owner_id, "status": "active"})

    all_deals = await db.crm_deals.find({"owner_id": owner_id}, {"_id": 0}).to_list(5000)
    won_deals = [d for d in all_deals if d.get("stage") == "won"]
    lost_deals = [d for d in all_deals if d.get("stage") == "lost"]
    active_deals = [d for d in all_deals if d.get("stage") not in ("won", "lost")]

    pipeline_value = sum(float(d.get("value", 0)) for d in active_deals)
    weighted_pipeline = sum(
        float(d.get("value", 0)) * (int(d.get("probability", 0)) / 100.0) for d in active_deals
    )
    won_value = sum(float(d.get("value", 0)) for d in won_deals)
    avg_deal_size = round(won_value / len(won_deals), 2) if won_deals else 0

    win_rate = 0
    total_closed = len(won_deals) + len(lost_deals)
    if total_closed:
        win_rate = round(len(won_deals) / total_closed * 100, 1)

    # by-stage counts
    by_stage = []
    for s in DEAL_STAGES:
        stage_deals = [d for d in all_deals if d.get("stage") == s["key"]]
        by_stage.append({
            **s,
            "count": len(stage_deals),
            "value": round(sum(float(d.get("value", 0)) for d in stage_deals), 2),
        })

    return {
        "clients_total": clients_total,
        "clients_active": clients_active,
        "deals_total": len(all_deals),
        "deals_active": len(active_deals),
        "deals_won": len(won_deals),
        "deals_lost": len(lost_deals),
        "pipeline_value": round(pipeline_value, 2),
        "weighted_pipeline": round(weighted_pipeline, 2),
        "won_value": round(won_value, 2),
        "avg_deal_size": avg_deal_size,
        "win_rate": win_rate,
        "by_stage": by_stage,
    }
