"""
Ru'ya Core — main FastAPI orchestrator.
Composed of 14 independent Engines under `engines/`.
Shared infrastructure lives in `core/`.
"""
import uuid
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core.deps import (
    db, now_iso, client, CORS_ORIGINS,
    COMMUNITIES_SEED, init_storage,
)

# ==================== Engines ====================
from engines import (
    auth_engine,
    social_engine,
    marketplace_engine,
    payment_engine,
    community_engine,
    team_engine,
    incubator_engine,
    ai_engine,
    notification_engine,
    search_engine,
    events_engine,
    academy_engine,
    crm_engine,
    admin_engine,
    analytics_engine,
    content_engine,
    tasks_engine,
    booking_engine,
    workspace_engine,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ruaa")

app = FastAPI(title="Ru'ya — Creative Operating System", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Attach all engine routers under /api
for eng in [
    auth_engine, social_engine, marketplace_engine, payment_engine,
    community_engine, team_engine, incubator_engine, ai_engine,
    notification_engine, search_engine, events_engine, academy_engine,
    crm_engine, admin_engine, analytics_engine,
    content_engine, tasks_engine, booking_engine, workspace_engine,
]:
    api_router.include_router(eng.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
async def root():
    return {
        "app": "Ru'ya",
        "version": "2.0.0",
        "tagline": "ندشن قصة حب جديدة مع عميلك",
        "engines": [
            "auth", "social", "marketplace", "payment", "community", "team",
            "incubator", "ai", "notification", "search", "events", "academy",
            "crm", "admin", "analytics", "content", "tasks", "booking",
        ],
    }


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    # Seed communities (idempotent)
    try:
        for c in COMMUNITIES_SEED:
            await db.communities.update_one(
                {"slug": c["slug"]},
                {"$setOnInsert": {**c, "id": str(uuid.uuid4()), "created_at": now_iso()}},
                upsert=True,
            )
        logger.info("Communities seeded")
    except Exception as e:
        logger.error(f"Community seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
