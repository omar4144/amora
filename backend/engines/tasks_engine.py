"""Tasks Engine: placeholder for Kanban + Tasks Management (future iteration)."""
from fastapi import APIRouter

router = APIRouter(tags=["tasks"])


@router.get("/tasks/ping")
async def tasks_ping():
    return {"engine": "tasks", "status": "placeholder", "planned": ["tasks", "kanban", "deadlines", "team-assign"]}
