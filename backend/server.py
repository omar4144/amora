"""
Amora Core — main FastAPI orchestrator.
Composed of 14 independent Engines under `engines/`.
Shared infrastructure lives in `core/`.
"""
import os
import uuid
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.deps import (
    db, now_iso, client, CORS_ORIGINS,
    COMMUNITIES_SEED, init_storage,
)
from core.security_utils import limiter

# ═══════════════════════════════════════════════════════════════
# SENTRY — safe no-op when SENTRY_DSN is unset
# ═══════════════════════════════════════════════════════════════
_SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=os.environ.get("SENTRY_ENV", "production"),
        release=os.environ.get("SENTRY_RELEASE", "amora@2.0.0"),
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
        send_default_pii=False,
        integrations=[FastApiIntegration(transaction_style="endpoint"), StarletteIntegration()],
    )
    logging.getLogger("sentry").info("Sentry initialised")

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
    invoice_engine,
    billing_engine,
    realtime_engine,
    disputes_engine,
    moderation_engine,
    moyasar_engine,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ruaa")

app = FastAPI(title="Amora — Creative Operating System", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api_router = APIRouter(prefix="/api")

# Attach all engine routers under /api
for eng in [
    auth_engine, social_engine, marketplace_engine, payment_engine,
    community_engine, team_engine, incubator_engine, ai_engine,
    notification_engine, search_engine, events_engine, academy_engine,
    crm_engine, admin_engine, analytics_engine,
    content_engine, tasks_engine, booking_engine, workspace_engine,
    invoice_engine, billing_engine, disputes_engine, moderation_engine,
    moyasar_engine,
]:
    api_router.include_router(eng.router)

# Realtime engine (WebSockets) must be attached to the main app, not api_router (limitations of nested routes)
app.include_router(realtime_engine.router, prefix="/api")

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
        "app": "Amora",
        "version": "2.0.0",
        "tagline": "ندشن قصة حب جديدة مع عميلك",
        "engines": [
            "auth", "social", "marketplace", "payment", "community", "team",
            "incubator", "ai", "notification", "search", "events", "academy",
            "crm", "admin", "analytics", "content", "tasks", "booking",
            "moderation",
        ],
    }


@app.get("/api/health")
async def health():
    """Liveness+readiness probe — verifies DB round-trip."""
    try:
        await db.command("ping")
        return {"status": "ok", "db": "up", "ts": now_iso()}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "down", "error": str(e), "ts": now_iso()},
        )


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
