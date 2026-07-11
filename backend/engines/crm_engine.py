"""CRM Engine: Landing page leads + (future) full CRM (clients, deals, invoices)."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, current_user
from core.schemas import LeadCreate

router = APIRouter(tags=["crm"])


@router.post("/leads")
async def create_lead(payload: LeadCreate):
    lead = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email,
        "story": payload.story.strip(),
        "status": "new",  # new | contacted | qualified | won | lost
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
