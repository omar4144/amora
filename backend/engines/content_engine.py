"""Content Engine: placeholder for Content OS (calendar, scriptwriting, publishing) — future iteration."""
from fastapi import APIRouter

router = APIRouter(tags=["content"])


@router.get("/content/ping")
async def content_ping():
    return {"engine": "content", "status": "placeholder", "planned": ["calendar", "scriptwriting", "review", "publishing", "analytics"]}
