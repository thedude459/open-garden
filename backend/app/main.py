import math
import secrets
import smtplib
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256
from threading import Lock
from time import time

from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .auth import create_access_token, get_admin_user, get_current_user, get_password_hash, verify_password
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import Bed, CropTemplate, Garden, PestLog, Placement, Planting, SeedInventory, Task, User, UserAuthToken
from .schemas import (
        ForgotPasswordPayload,
        MessageOut,
    BedCreate,
    BedPositionUpdate,
    BedOut,
    CropTemplateCreate,
    CropTemplateOut,
    GardenCreate,
    GardenYardUpdate,
    GardenOut,
    PlacementCreate,
    PlacementMove,
    PlacementOut,
    PestLogCreate,
    PestLogOut,
    PlantingCreate,
    PlantingOut,
    PlantingHarvestUpdate,
    SeedInventoryCreate,
    SeedInventoryOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    Token,
    VerifyEmailPayload,
    ResetPasswordPayload,
    UserCreate,
    UserOut,
)
from .seed import seed_crop_templates
from .weather import fetch_weather, fetch_zip_profile

app = FastAPI(title="open-garden-api")

_RATE_LIMIT_LOCK = Lock()
_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _rate_limit_hit(key: str, limit: int, window_seconds: int) -> int | None:
    now = time()
    oldest = now - window_seconds
    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS[key]
        while bucket and bucket[0] <= oldest:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            return retry_after
        bucket.append(now)
    return None


def _enforce_rate_limit(request: Request, bucket: str, limit: int, window_seconds: int, identity: str = "") -> None:
    ip = _client_ip(request)
    key = f"{bucket}:{ip}:{identity}" if identity else f"{bucket}:{ip}"
    retry_after = _rate_limit_hit(key, limit, window_seconds)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


@app.middleware("http")
async def apply_security_controls(request: Request, call_next) -> Response:
    retry_after = _rate_limit_hit(
        key=f"global:{_client_ip(request)}",
        limit=settings.global_rate_limit_per_minute,
        window_seconds=60,
    )
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


def _hash_token(raw_token: str) -> str:
    return sha256(raw_token.encode("utf-8")).hexdigest()


def _issue_user_token(db: Session, user_id: int, purpose: str, expire_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=expire_minutes)
    raw_token = secrets.token_urlsafe(32)
    token_row = UserAuthToken(
        user_id=user_id,
        purpose=purpose,
        token_hash=_hash_token(raw_token),
        expires_at=expires,
    )
    db.add(token_row)
    db.commit()
    return raw_token


def _consume_user_token(db: Session, raw_token: str, purpose: str) -> UserAuthToken | None:
    token_hash = _hash_token(raw_token)
    token_row = db.query(UserAuthToken).filter(UserAuthToken.token_hash == token_hash, UserAuthToken.purpose == purpose).first()
    if token_row is None or token_row.used_at is not None:
        return None
    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    token_row.used_at = datetime.now(timezone.utc)
    db.add(token_row)
    db.commit()
    db.refresh(token_row)
    return token_row


def _send_email_or_log(to_email: str, subject: str, body_text: str) -> None:
    if not settings.smtp_host:
        if settings.env == "production":
            raise RuntimeError("SMTP_HOST must be configured in production.")
        print(f"[email-fallback] To: {to_email}\\nSubject: {subject}\\n{body_text}")
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body_text)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


@app.on_event("startup")
def startup() -> None:
    if settings.env == "production" and not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is required in production to avoid token-link log fallback.")

    Base.metadata.create_all(bind=engine)

    # Run Alembic migrations to apply any column-level changes.
    alembic_cfg = AlembicConfig("/app/alembic.ini")
    alembic_command.upgrade(alembic_cfg, "head")

    db = SessionLocal()
    try:
        seed_crop_templates(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/auth/register", response_model=UserOut)
def register_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-register",
        limit=settings.auth_register_limit_per_minute,
        window_seconds=60,
        identity=payload.username.lower(),
    )

    if db.query(User).filter(or_(User.email == payload.email, User.username == payload.username)).first():
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    verify_token = _issue_user_token(db, user.id, "email_verify", settings.email_verification_expire_minutes)
    verify_link = f"{settings.frontend_base_url}?verify_token={verify_token}"
    _send_email_or_log(
        user.email,
        "Verify your open-garden email",
        (
            "Welcome to open-garden!\n\n"
            "Please verify your email address by opening this link:\n"
            f"{verify_link}\n\n"
            f"This link expires in {settings.email_verification_expire_minutes} minutes."
        ),
    )
    return user


@app.post("/auth/verify-email", response_model=MessageOut)
def verify_email(payload: VerifyEmailPayload, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-verify",
        limit=settings.auth_verify_limit_per_minute,
        window_seconds=60,
    )

    token_row = _consume_user_token(db, payload.token, "email_verify")
    if token_row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user = db.query(User).filter(User.id == token_row.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return {"message": "Email verified successfully."}


@app.post("/auth/resend-verification", response_model=MessageOut)
def resend_verification(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-resend",
        limit=settings.auth_resend_limit_per_hour,
        window_seconds=3600,
        identity=current_user.email.lower(),
    )

    if current_user.email_verified:
        return {"message": "Email is already verified."}
    verify_token = _issue_user_token(db, current_user.id, "email_verify", settings.email_verification_expire_minutes)
    verify_link = f"{settings.frontend_base_url}?verify_token={verify_token}"
    _send_email_or_log(
        current_user.email,
        "Verify your open-garden email",
        (
            "Please verify your email address by opening this link:\n"
            f"{verify_link}\n\n"
            f"This link expires in {settings.email_verification_expire_minutes} minutes."
        ),
    )
    return {"message": "Verification email sent."}


@app.post("/auth/forgot-password", response_model=MessageOut)
def forgot_password(payload: ForgotPasswordPayload, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-forgot",
        limit=settings.auth_forgot_limit_per_hour,
        window_seconds=3600,
        identity=payload.email.lower(),
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.email_verified:
        reset_token = _issue_user_token(db, user.id, "password_reset", settings.password_reset_expire_minutes)
        reset_link = f"{settings.frontend_base_url}?reset_token={reset_token}"
        _send_email_or_log(
            user.email,
            "Reset your open-garden password",
            (
                "A password reset was requested for your account.\n\n"
                "Use this link to set a new password:\n"
                f"{reset_link}\n\n"
                f"This link expires in {settings.password_reset_expire_minutes} minutes."
            ),
        )
    return {"message": "If an account exists, reset instructions have been sent."}


@app.post("/auth/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordPayload, request: Request, db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-reset",
        limit=settings.auth_reset_limit_per_minute,
        window_seconds=60,
    )

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    token_row = _consume_user_token(db, payload.token, "password_reset")
    if token_row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.id == token_row.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password reset successful. You can now sign in."}


@app.post("/auth/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    _enforce_rate_limit(
        request,
        bucket="auth-login",
        limit=settings.auth_login_limit_per_minute,
        window_seconds=60,
        identity=form_data.username.lower(),
    )

    user = db.query(User).filter(User.username == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    return {"access_token": create_access_token(user.username), "token_type": "bearer"}


@app.get("/users/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.delete("/users/me")
def delete_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete the authenticated user and all their data. Used for test cleanup."""
    user_id = current_user.id
    gardens = db.query(Garden).filter(Garden.owner_id == user_id).all()
    for garden in gardens:
        gid = garden.id
        db.query(PestLog).filter(PestLog.garden_id == gid).delete()
        db.query(Task).filter(Task.garden_id == gid).delete()
        db.query(Planting).filter(Planting.garden_id == gid).delete()
        db.query(Placement).filter(Placement.garden_id == gid).delete()
        db.delete(garden)
    db.query(SeedInventory).filter(SeedInventory.user_id == user_id).delete()
    db.query(UserAuthToken).filter(UserAuthToken.user_id == user_id).delete()
    db.delete(current_user)
    db.commit()
    return {"status": "deleted"}


@app.post("/gardens", response_model=GardenOut)
async def create_garden(payload: GardenCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        location = await fetch_zip_profile(payload.zip_code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    garden = Garden(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        zip_code=location["zip_code"],
        growing_zone=location["growing_zone"],
        yard_width_ft=max(4, payload.yard_width_ft),
        yard_length_ft=max(4, payload.yard_length_ft),
        latitude=location["latitude"],
        longitude=location["longitude"],
        address_private=payload.address_private,
        is_shared=payload.is_shared,
    )
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@app.get("/gardens", response_model=list[GardenOut])
def list_my_gardens(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Garden).filter(Garden.owner_id == current_user.id).all()


@app.get("/gardens/public", response_model=list[GardenOut])
def list_public_gardens(db: Session = Depends(get_db)):
    return db.query(Garden).filter(Garden.is_shared.is_(True)).all()


@app.patch("/gardens/{garden_id}/yard", response_model=GardenOut)
def update_garden_yard(garden_id: int, payload: GardenYardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    garden.yard_width_ft = max(4, payload.yard_width_ft)
    garden.yard_length_ft = max(4, payload.yard_length_ft)
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@app.get("/crop-templates", response_model=list[CropTemplateOut])
def list_crop_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()


def _crop_name_parts(crop_name: str, variety: str = "") -> tuple[str, str]:
    clean_variety = variety.strip()
    if clean_variety and crop_name.endswith(f" ({clean_variety})"):
        return crop_name[: -(len(clean_variety) + 3)].strip(), clean_variety
    return crop_name.strip(), clean_variety


def _normalized_crop_identity(crop_name: str, variety: str = "") -> tuple[str, str]:
    clean_name = crop_name.strip()
    clean_variety = variety.strip()
    if not clean_variety and clean_name.endswith(")") and " (" in clean_name:
        base, suffix = clean_name.rsplit(" (", 1)
        clean_name = base.strip()
        clean_variety = suffix[:-1].strip()
    return clean_name.lower(), clean_variety.lower()


def _crop_task_title(crop_name: str, action: str, variety: str = "") -> str:
    base_name, clean_variety = _crop_name_parts(crop_name, variety)
    if clean_variety:
        return f"{base_name} • {clean_variety}: {action}"
    return f"{base_name}: {action}"


@app.post("/crop-templates", response_model=CropTemplateOut)
def create_crop_template(payload: CropTemplateCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    base_name = payload.name.strip()
    variety = payload.variety.strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="Crop name is required")

    target_identity = _normalized_crop_identity(base_name, variety)
    existing = next(
        (
            candidate
            for candidate in db.query(CropTemplate).all()
            if _normalized_crop_identity(candidate.name, candidate.variety) == target_identity
        ),
        None,
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Crop already exists")

    crop = CropTemplate(
        name=base_name,
        variety=variety,
        family=payload.family.strip(),
        spacing_in=max(1, payload.spacing_in),
        days_to_harvest=max(1, payload.days_to_harvest),
        planting_window=payload.planting_window.strip() or "Spring",
        direct_sow=payload.direct_sow,
        frost_hardy=payload.frost_hardy,
        weeks_to_transplant=max(1, payload.weeks_to_transplant),
        notes=payload.notes.strip(),
    )
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


@app.patch("/crop-templates/{crop_id}", response_model=CropTemplateOut)
def update_crop_template(crop_id: int, payload: CropTemplateCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    crop = db.query(CropTemplate).filter(CropTemplate.id == crop_id).first()
    if crop is None:
        raise HTTPException(status_code=404, detail="Crop not found")

    base_name = payload.name.strip()
    variety = payload.variety.strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="Crop name is required")

    target_identity = _normalized_crop_identity(base_name, variety)
    existing = next(
        (
            candidate
            for candidate in db.query(CropTemplate).filter(CropTemplate.id != crop_id).all()
            if _normalized_crop_identity(candidate.name, candidate.variety) == target_identity
        ),
        None,
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Crop already exists")

    old_name = crop.name
    old_planting_ids = [row.id for row in db.query(Planting.id).filter(Planting.crop_name == old_name).all()]

    crop.name = base_name
    crop.variety = variety
    crop.family = payload.family.strip()
    crop.spacing_in = max(1, payload.spacing_in)
    crop.days_to_harvest = max(1, payload.days_to_harvest)
    crop.planting_window = payload.planting_window.strip() or "Spring"
    crop.direct_sow = payload.direct_sow
    crop.frost_hardy = payload.frost_hardy
    crop.weeks_to_transplant = max(1, payload.weeks_to_transplant)
    crop.notes = payload.notes.strip()

    if old_name != base_name:
        db.query(Placement).filter(Placement.crop_name == old_name).update({Placement.crop_name: base_name}, synchronize_session=False)
        db.query(Planting).filter(Planting.crop_name == old_name).update({Planting.crop_name: base_name}, synchronize_session=False)

        if old_planting_ids:
            tasks = db.query(Task).filter(Task.planting_id.in_(old_planting_ids)).all()
            for task in tasks:
                action = task.title.split(": ", 1)[1] if ": " in task.title else task.title
                task.title = _crop_task_title(base_name, action, variety)
                db.add(task)

    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


def _required_spacing(db: Session, crop_name: str) -> int:
    template = db.query(CropTemplate).filter(CropTemplate.name == crop_name).first()
    if template is None:
        return 12
    return max(1, template.spacing_in)


def _validate_spacing(db: Session, *, garden_id: int, bed_id: int, crop_name: str, grid_x: int, grid_y: int, ignore_id: int | None = None) -> None:
    candidate_spacing = _required_spacing(db, crop_name)
    query = db.query(Placement).filter(Placement.garden_id == garden_id, Placement.bed_id == bed_id)
    if ignore_id is not None:
        query = query.filter(Placement.id != ignore_id)

    for existing in query.all():
        existing_spacing = _required_spacing(db, existing.crop_name)
        required_clearance = max(candidate_spacing, existing_spacing)
        distance_in = math.sqrt(((grid_x - existing.grid_x) * 12) ** 2 + ((grid_y - existing.grid_y) * 12) ** 2)
        if distance_in < required_clearance:
            raise HTTPException(
                status_code=409,
                detail=f"Too close to {existing.crop_name}. Required spacing is {required_clearance} inches.",
            )


@app.post("/gardens/{garden_id}/beds", response_model=BedOut)
def create_bed(garden_id: int, payload: BedCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    bed = Bed(garden_id=garden_id, **payload.model_dump())
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@app.get("/gardens/{garden_id}/beds", response_model=list[BedOut])
def list_beds(garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return db.query(Bed).filter(Bed.garden_id == garden_id).all()


@app.patch("/beds/{bed_id}/position", response_model=BedOut)
def update_bed_position(bed_id: int, payload: BedPositionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if bed is None:
        raise HTTPException(status_code=404, detail="Bed not found")

    garden = db.query(Garden).filter(Garden.id == bed.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    bed_width_ft = max(1, math.ceil(bed.width_in / 12))
    bed_length_ft = max(1, math.ceil(bed.height_in / 12))
    max_x = max(0, garden.yard_width_ft - bed_width_ft)
    max_y = max(0, garden.yard_length_ft - bed_length_ft)

    bed.grid_x = min(max(0, payload.grid_x), max_x)
    bed.grid_y = min(max(0, payload.grid_y), max_y)
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@app.delete("/beds/{bed_id}")
def delete_bed(bed_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if bed is None:
        raise HTTPException(status_code=404, detail="Bed not found")

    garden = db.query(Garden).filter(Garden.id == bed.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    db.query(Placement).filter(Placement.bed_id == bed_id).delete()
    db.query(Planting).filter(Planting.bed_id == bed_id).delete()
    db.delete(bed)
    db.commit()
    return {"status": "deleted"}


@app.delete("/gardens/{garden_id}")
def delete_garden(garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    db.query(PestLog).filter(PestLog.garden_id == garden_id).delete()
    db.query(Task).filter(Task.garden_id == garden_id).delete()
    db.query(Planting).filter(Planting.garden_id == garden_id).delete()
    db.query(Placement).filter(Placement.garden_id == garden_id).delete()
    # beds FK-cascade is handled by ORM relationship cascade
    db.delete(garden)
    db.commit()
    return {"status": "deleted"}


@app.post("/placements", response_model=PlacementOut)
def create_placement(payload: PlacementCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    bed = db.query(Bed).filter(Bed.id == payload.bed_id, Bed.garden_id == payload.garden_id).first()
    if bed is None:
        raise HTTPException(status_code=404, detail="Bed not found")

    existing = (
        db.query(Placement)
        .filter(
            Placement.garden_id == payload.garden_id,
            Placement.bed_id == payload.bed_id,
            Placement.grid_x == payload.grid_x,
            Placement.grid_y == payload.grid_y,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Cell is already occupied")

    _validate_spacing(
        db,
        garden_id=payload.garden_id,
        bed_id=payload.bed_id,
        crop_name=payload.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
    )

    placement = Placement(**payload.model_dump())
    db.add(placement)
    db.commit()
    db.refresh(placement)
    return placement


@app.get("/placements", response_model=list[PlacementOut])
def list_placements(garden_id: int, bed_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    query = db.query(Placement).filter(Placement.garden_id == garden_id)
    if bed_id is not None:
        query = query.filter(Placement.bed_id == bed_id)
    return query.order_by(Placement.bed_id.asc(), Placement.grid_y.asc(), Placement.grid_x.asc()).all()


@app.patch("/placements/{placement_id}/move", response_model=PlacementOut)
def move_placement(placement_id: int, payload: PlacementMove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    placement = db.query(Placement).filter(Placement.id == placement_id).first()
    if placement is None:
        raise HTTPException(status_code=404, detail="Placement not found")

    garden = db.query(Garden).filter(Garden.id == placement.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    target_bed = db.query(Bed).filter(Bed.id == payload.bed_id, Bed.garden_id == placement.garden_id).first()
    if target_bed is None:
        raise HTTPException(status_code=404, detail="Target bed not found")

    conflict = (
        db.query(Placement)
        .filter(
            Placement.garden_id == placement.garden_id,
            Placement.bed_id == payload.bed_id,
            Placement.grid_x == payload.grid_x,
            Placement.grid_y == payload.grid_y,
            Placement.id != placement.id,
        )
        .first()
    )
    if conflict is not None:
        raise HTTPException(status_code=409, detail="Target cell is already occupied")

    _validate_spacing(
        db,
        garden_id=placement.garden_id,
        bed_id=payload.bed_id,
        crop_name=placement.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
        ignore_id=placement.id,
    )

    placement.bed_id = payload.bed_id
    placement.grid_x = payload.grid_x
    placement.grid_y = payload.grid_y
    db.add(placement)
    db.commit()
    db.refresh(placement)
    return placement


@app.delete("/placements/{placement_id}")
def delete_placement(placement_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    placement = db.query(Placement).filter(Placement.id == placement_id).first()
    if placement is None:
        raise HTTPException(status_code=404, detail="Placement not found")

    garden = db.query(Garden).filter(Garden.id == placement.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    db.delete(placement)
    db.commit()
    return {"status": "deleted"}


@app.post("/plantings", response_model=PlantingOut)
def create_planting(payload: PlantingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    template = db.query(CropTemplate).filter(CropTemplate.name == payload.crop_name).first()
    days_to_harvest = template.days_to_harvest if template else 60
    direct_sow = template.direct_sow if template else True
    weeks_to_transplant = max(1, template.weeks_to_transplant if template else 6)
    crop_notes = template.notes if template else ""
    crop_variety = template.variety if template else ""
    expected_harvest = payload.planted_on + timedelta(days=days_to_harvest)

    planting = Planting(
        garden_id=payload.garden_id,
        bed_id=payload.bed_id,
        crop_name=payload.crop_name,
        planted_on=payload.planted_on,
        expected_harvest_on=expected_harvest,
        source=payload.source,
    )
    db.add(planting)
    db.commit()
    db.refresh(planting)

    zone = garden.growing_zone or "Unknown"
    zone_note = f" (Zone {zone})" if zone and zone != "Unknown" else ""
    crop = payload.crop_name
    t0 = payload.planted_on

    # List of (title, due_on, notes) for all auto-generated tasks
    auto_tasks: list[tuple[str, object, str]] = []

    # ── Sow / transplant ─────────────────────────────────────────────────────
    if not direct_sow:
        start_date = t0 - timedelta(days=weeks_to_transplant * 7)
        auto_tasks.append((
            _crop_task_title(crop, "Start seeds indoors", crop_variety),
            start_date,
            f"Fill trays with seed-starting mix. Sow 2 seeds per cell at 70–75 °F{zone_note}. "
            f"Thin to strongest seedling once germinated.",
        ))
        harden_date = t0 - timedelta(days=7)
        if harden_date > start_date:
            auto_tasks.append((
                _crop_task_title(crop, "Harden off seedlings", crop_variety),
                harden_date,
                f"Move seedlings outside in a sheltered spot for 2-3 hrs/day{zone_note}. "
                f"Increase exposure over 7 days to avoid transplant shock.",
            ))
        auto_tasks.append((
            _crop_task_title(crop, "Transplant seedlings to bed", crop_variety),
            t0,
            f"Plant at soil level. Water in with dilute liquid fertiliser{zone_note}. "
            f"Protect with row cover if frost is still possible.",
        ))
    else:
        auto_tasks.append((
            _crop_task_title(crop, "Direct sow seeds", crop_variety),
            t0,
            f"Sow seeds at the depth and spacing shown on the packet{zone_note}. "
            f"Keep soil moist (not saturated) until emergence.",
        ))

    # ── Early watering ────────────────────────────────────────────────────────
    auto_tasks.append((
        _crop_task_title(crop, "Water and check establishment", crop_variety),
        t0 + timedelta(days=3),
        "Check soil 1 inch deep — water when dry. Consistent moisture is critical in the first two weeks.",
    ))
    if days_to_harvest > 10:
        auto_tasks.append((
            _crop_task_title(crop, "Water and thin seedlings", crop_variety),
            t0 + timedelta(days=10),
            "Thin direct-sown seedlings if crowded. Water at the base; avoid wetting foliage.",
        ))

    # ── First weeding and pest check ─────────────────────────────────────────
    if days_to_harvest > 14:
        auto_tasks.append((
            _crop_task_title(crop, "Weed bed", crop_variety),
            t0 + timedelta(days=14),
            "Remove weeds before they compete for nutrients. Shallow hoe to avoid disturbing roots.",
        ))
        auto_tasks.append((
            _crop_task_title(crop, "Pest and disease check", crop_variety),
            t0 + timedelta(days=7),
            f"Inspect leaves top and underside for pests, discolouration or disease{zone_note}. "
            f"Treat organically early — neem oil or insecticidal soap for soft-bodied insects.",
        ))

    # ── Fertilise ────────────────────────────────────────────────────────────
    if days_to_harvest > 20:
        auto_tasks.append((
            _crop_task_title(crop, "Fertilise", crop_variety),
            t0 + timedelta(days=20),
            "Apply balanced fertiliser (e.g. 10-10-10) or side-dress with compost. "
            "Avoid excess nitrogen once flowering begins.",
        ))

    # ── Mid-season tasks ─────────────────────────────────────────────────────
    if days_to_harvest > 40:
        auto_tasks.append((
            _crop_task_title(crop, "Mid-season weed and water check", crop_variety),
            t0 + timedelta(days=40),
            "Remove weeds; check mulch depth (2-3 in helps retain moisture and suppress weeds). "
            "Deep watering every few days is better than shallow daily watering.",
        ))
    if days_to_harvest > 45:
        auto_tasks.append((
            _crop_task_title(crop, "Mid-season pest inspection", crop_variety),
            t0 + timedelta(days=45),
            "Check for disease progression; remove and dispose of infected leaves. "
            "Apply a second round of fertiliser if growth looks slow.",
        ))

    # ── Late-season ───────────────────────────────────────────────────────────
    if days_to_harvest > 70:
        auto_tasks.append((
            _crop_task_title(crop, "Late-season check", crop_variety),
            t0 + timedelta(days=70),
            f"Ensure adequate water as fruit/roots swell{zone_note}. "
            f"Watch for late blight (wet weather). Begin preparing bed for next crop rotation.",
        ))

    # ── Harvest ───────────────────────────────────────────────────────────────
    harvest_note = f"Expected ~day {days_to_harvest}{zone_note}."
    if crop_notes:
        harvest_note += f" {crop_notes}"
    auto_tasks.append((
        _crop_task_title(crop, "Harvest window opens", crop_variety),
        t0 + timedelta(days=days_to_harvest),
        harvest_note,
    ))

    for title, due_on, notes in auto_tasks:
        db.add(Task(
            garden_id=payload.garden_id,
            planting_id=planting.id,
            title=title,
            due_on=due_on,
            notes=notes,
        ))
    db.commit()

    return planting


@app.get("/plantings", response_model=list[PlantingOut])
def list_plantings(garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return db.query(Planting).filter(Planting.garden_id == garden_id).all()


@app.patch("/plantings/{planting_id}/harvest", response_model=PlantingOut)
def log_harvest(planting_id: int, payload: PlantingHarvestUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    planting = db.query(Planting).filter(Planting.id == planting_id).first()
    if planting is None:
        raise HTTPException(status_code=404, detail="Planting not found")
    garden = db.query(Garden).filter(Garden.id == planting.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=403, detail="Forbidden")
    planting.harvested_on = payload.harvested_on
    planting.yield_notes = payload.yield_notes
    db.commit()
    db.refresh(planting)
    return planting


@app.post("/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    task = Task(**payload.model_dump(), planting_id=None)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks", response_model=list[TaskOut])
def list_tasks(garden_id: int, q: str = Query("", min_length=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    query = db.query(Task).filter(Task.garden_id == garden_id)
    if q:
        like_q = f"%{q.lower()}%"
        query = query.filter(or_(Task.title.ilike(like_q), Task.notes.ilike(like_q)))
    return query.order_by(Task.due_on.asc()).all()


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    garden = db.query(Garden).filter(Garden.id == task.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    if payload.is_done is not None:
        task.is_done = payload.is_done
    if payload.title is not None:
        task.title = payload.title
    if payload.due_on is not None:
        task.due_on = payload.due_on
    if payload.notes is not None:
        task.notes = payload.notes
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    garden = db.query(Garden).filter(Garden.id == task.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(task)
    db.commit()


@app.post("/seed-inventory", response_model=SeedInventoryOut)
def add_seed_inventory(payload: SeedInventoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = SeedInventory(user_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/seed-inventory", response_model=list[SeedInventoryOut])
def list_seed_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SeedInventory).filter(SeedInventory.user_id == current_user.id).all()


@app.post("/pest-logs", response_model=PestLogOut)
def create_pest_log(payload: PestLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    item = PestLog(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/pest-logs", response_model=list[PestLogOut])
def list_pest_logs(garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return db.query(PestLog).filter(PestLog.garden_id == garden_id).all()


@app.delete("/pest-logs/{pest_log_id}")
def delete_pest_log(pest_log_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pest_log = db.query(PestLog).filter(PestLog.id == pest_log_id).first()
    if pest_log is None:
        raise HTTPException(status_code=404, detail="Pest log entry not found")
    garden = db.query(Garden).filter(Garden.id == pest_log.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(pest_log)
    db.commit()
    return {"status": "deleted"}


@app.get("/weather")
async def get_weather(latitude: float, longitude: float):
    return await fetch_weather(latitude, longitude)


@app.get("/admin/users", response_model=list[UserOut])
def list_users_admin(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    return db.query(User).all()


@app.post("/admin/users/{user_id}/disable", response_model=UserOut)
def disable_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
