from contextlib import asynccontextmanager
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import settings
from .database import Base, SessionLocal, engine
from .logging_utils import get_logger
from .models import CropTemplate
from .core.rate_limit import enforce_rate_limit, global_rate_limit_hit
from .routers import (
    admin_router,
    auth_router,
    crops_router,
    gardens_router,
    insights_router,
    planner_router,
    sensors_router,
    tasks_router,
)
from .routers.crops import start_crop_sync
from .services import ensure_crop_sync_state, update_crop_sync_state
from .weather import fetch_weather

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.env == "production" and not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is required in production to avoid token-link log fallback.")

    if settings.env != "production":
        Base.metadata.create_all(bind=engine)

    alembic_path = Path("/app/alembic.ini")
    if not alembic_path.exists():
        alembic_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    alembic_cfg = AlembicConfig(str(alembic_path))
    alembic_command.upgrade(alembic_cfg, "head")

    db = SessionLocal()
    try:
        ensure_crop_sync_state(db)
        existing_import_count = (
            db.query(CropTemplate).filter(CropTemplate.source == "johnnys-selected-seeds").count()
        )
        if existing_import_count == 0:
            start_crop_sync(force_refresh=False)
        else:
            update_crop_sync_state(
                db,
                status="idle",
                is_running=False,
                message="Johnny's crop catalog is already present.",
                skipped=existing_import_count,
                error=None,
            )
    finally:
        db.close()

    yield


app = FastAPI(title="open-garden-api", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(crops_router)
app.include_router(gardens_router)
app.include_router(insights_router)
app.include_router(planner_router)
app.include_router(sensors_router)
app.include_router(tasks_router)


@app.middleware("http")
async def apply_security_controls(request: Request, call_next) -> Response:
    retry_after = global_rate_limit_hit(request)
    if retry_after is not None:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down."},
            headers={"Retry-After": str(retry_after)},
        )

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if settings.env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/auth/"):
        response.headers["Cache-Control"] = "no-store"

    return response


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/weather")
async def get_weather(request: Request, latitude: float, longitude: float):
    enforce_rate_limit(request, "weather", 20, 60)
    return await fetch_weather(latitude, longitude)
