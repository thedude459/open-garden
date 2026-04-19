"""Auth routes: registration, email verification, password reset, login, and user account."""

import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.auth import create_access_token, get_current_user, get_password_hash, verify_password
from ..config import settings
from ..database import get_db
from ..core.logging_utils import get_logger
from ..models import (
    Garden,
    PestLog,
    Planting,
    Sensor,
    SensorReading,
    SeedInventory,
    Task,
    User,
    UserAuthToken,
)
from ..core.rate_limit import enforce_rate_limit
from ..schemas import (
    ForgotPasswordPayload,
    ForgotUsernamePayload,
    MessageOut,
    ResetPasswordPayload,
    Token,
    UserCreate,
    UserOut,
    VerifyEmailPayload,
)

router = APIRouter()
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


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
    token_row = (
        db.query(UserAuthToken)
        .filter(UserAuthToken.token_hash == token_hash, UserAuthToken.purpose == purpose)
        .first()
    )
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
        logger.warning("email fallback delivery", extra={"to_email": to_email, "subject": subject})
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


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------


@router.post("/auth/register", response_model=UserOut)
def register_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
        request,
        bucket="auth-register",
        limit=settings.auth_register_limit_per_minute,
        window_seconds=60,
        identity=payload.username.lower(),
    )

    if (
        db.query(User)
        .filter(or_(User.email == payload.email, User.username == payload.username))
        .first()
    ):
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

    verify_token = _issue_user_token(
        db, user.id, "email_verify", settings.email_verification_expire_minutes
    )
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


@router.post("/auth/verify-email", response_model=MessageOut)
def verify_email(payload: VerifyEmailPayload, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
        request,
        bucket="auth-verify",
        limit=settings.auth_verify_limit_per_minute,
        window_seconds=60,
    )

    # Idempotency: if the token was already consumed and the user is verified,
    # treat repeated clicks as success instead of an error.
    existing = (
        db.query(UserAuthToken)
        .filter(
            UserAuthToken.token_hash == _hash_token(payload.token),
            UserAuthToken.purpose == "email_verify",
        )
        .first()
    )
    if existing is not None and existing.used_at is not None:
        user = db.query(User).filter(User.id == existing.user_id).first()
        if user is not None and user.email_verified:
            return {"message": "Email verified successfully."}

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


@router.post("/auth/resend-verification", response_model=MessageOut)
def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        bucket="auth-resend",
        limit=settings.auth_resend_limit_per_hour,
        window_seconds=3600,
        identity=current_user.email.lower(),
    )

    if current_user.email_verified:
        return {"message": "Email is already verified."}
    verify_token = _issue_user_token(
        db, current_user.id, "email_verify", settings.email_verification_expire_minutes
    )
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


@router.post("/auth/forgot-password", response_model=MessageOut)
def forgot_password(
    payload: ForgotPasswordPayload, request: Request, db: Session = Depends(get_db)
):
    enforce_rate_limit(
        request,
        bucket="auth-forgot",
        limit=settings.auth_forgot_limit_per_hour,
        window_seconds=3600,
        identity=payload.email.lower(),
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.email_verified:
        reset_token = _issue_user_token(
            db, user.id, "password_reset", settings.password_reset_expire_minutes
        )
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


@router.post("/auth/forgot-username", response_model=MessageOut)
def forgot_username(
    payload: ForgotUsernamePayload, request: Request, db: Session = Depends(get_db)
):
    enforce_rate_limit(
        request,
        bucket="auth-forgot-username",
        limit=settings.auth_forgot_limit_per_hour,
        window_seconds=3600,
        identity=payload.email.lower(),
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.email_verified:
        _send_email_or_log(
            user.email,
            "Your open-garden username",
            (
                "You requested to recover your username.\n\n"
                f"Your username is: {user.username}\n\n"
                "Use this to sign in to your account."
            ),
        )
    return {"message": "If an account exists, username recovery instructions have been sent."}


@router.post("/auth/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordPayload, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
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


@router.post("/auth/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
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


# ---------------------------------------------------------------------------
# User account routes
# ---------------------------------------------------------------------------


@router.get("/users/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.delete("/users/me")
def delete_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete the authenticated user and all their data. Used for test cleanup."""
    user_id = current_user.id
    gardens = db.query(Garden).filter(Garden.owner_id == user_id).all()
    for garden in gardens:
        gid = garden.id
        db.query(PestLog).filter(PestLog.garden_id == gid).delete()
        db.query(Task).filter(Task.garden_id == gid).delete()
        db.query(Planting).filter(Planting.garden_id == gid).delete()
        sensor_ids = [row.id for row in db.query(Sensor.id).filter(Sensor.garden_id == gid).all()]
        if sensor_ids:
            db.query(SensorReading).filter(SensorReading.sensor_id.in_(sensor_ids)).delete(
                synchronize_session=False
            )
        db.query(Sensor).filter(Sensor.garden_id == gid).delete()
        db.delete(garden)
    db.query(SeedInventory).filter(SeedInventory.user_id == user_id).delete()
    db.query(UserAuthToken).filter(UserAuthToken.user_id == user_id).delete()
    db.delete(current_user)
    db.commit()
    return {"status": "deleted"}
