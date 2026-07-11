"""Admin Engine: placeholder for RBAC dashboards + platform stats (future iteration)."""
from fastapi import APIRouter

router = APIRouter(tags=["admin"])


@router.get("/admin/ping")
async def admin_ping():
    return {"engine": "admin", "status": "placeholder", "planned": ["rbac", "dashboards", "user-management"]}
