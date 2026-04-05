from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.auth import get_password_hash, verify_password
from app.models import SeedInventory, User, UserAuthToken
from app.routers import auth as auth_router
from app.schemas import (
    ForgotPasswordPayload,
    ForgotUsernamePayload,
    ResetPasswordPayload,
    UserCreate,
    VerifyEmailPayload,
)


def _request(ip="127.0.0.1"):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=ip))


@pytest.fixture(autouse=True)
def disable_rate_limit_and_email(monkeypatch, request):
    monkeypatch.setattr(auth_router, "enforce_rate_limit", lambda *args, **kwargs: None)
    sent = []
    if request.node.get_closest_marker("real_email") is None:
        monkeypatch.setattr(auth_router, "_send_email_or_log", lambda *args: sent.append(args))
    return sent


def test_register_user_creates_unverified_user(db_session):
    created = auth_router.register_user(
        payload=UserCreate(email="new@example.com", username="newbie", password="password123"),
        request=_request(),
        db=db_session,
    )

    token_row = db_session.query(UserAuthToken).filter(UserAuthToken.user_id == created.id).one()

    assert created.email_verified is False
    assert token_row.purpose == "email_verify"


def test_register_user_rejects_duplicate_username(db_session, user):
    with pytest.raises(HTTPException) as exc:
        auth_router.register_user(
            payload=UserCreate(
                email="else@example.com", username=user.username, password="password123"
            ),
            request=_request(),
            db=db_session,
        )

    assert exc.value.status_code == 400


def test_verify_email_marks_user_verified_and_is_idempotent(db_session):
    user = User(
        email="verify@example.com",
        username="verifyme",
        hashed_password="hashed",
        email_verified=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = auth_router._issue_user_token(db_session, user.id, "email_verify", 30)

    first = auth_router.verify_email(VerifyEmailPayload(token=token), _request(), db_session)
    second = auth_router.verify_email(VerifyEmailPayload(token=token), _request(), db_session)

    db_session.refresh(user)
    assert first == {"message": "Email verified successfully."}
    assert second == {"message": "Email verified successfully."}
    assert user.email_verified is True


def test_verify_email_rejects_invalid_token(db_session):
    with pytest.raises(HTTPException) as exc:
        auth_router.verify_email(VerifyEmailPayload(token="bad"), _request(), db_session)

    assert exc.value.status_code == 400


def test_forgot_password_is_non_enumerating(db_session):
    result = auth_router.forgot_password(
        ForgotPasswordPayload(email="missing@example.com"), _request(), db_session
    )

    assert result == {"message": "If an account exists, reset instructions have been sent."}


def test_forgot_password_issues_token_for_verified_user(db_session):
    user = User(
        email="forgot@example.com",
        username="forgot",
        hashed_password="hashed",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    result = auth_router.forgot_password(
        ForgotPasswordPayload(email=user.email), _request(), db_session
    )

    assert result == {"message": "If an account exists, reset instructions have been sent."}
    assert (
        db_session.query(UserAuthToken)
        .filter(UserAuthToken.user_id == user.id, UserAuthToken.purpose == "password_reset")
        .count()
        == 1
    )


def test_forgot_username_is_non_enumerating(db_session):
    result = auth_router.forgot_username(
        ForgotUsernamePayload(email="missing@example.com"), _request(), db_session
    )

    assert result == {
        "message": "If an account exists, username recovery instructions have been sent."
    }


def test_reset_password_updates_hash(db_session):
    user = User(
        email="reset@example.com",
        username="resetme",
        hashed_password=get_password_hash("before-pass"),
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = auth_router._issue_user_token(db_session, user.id, "password_reset", 30)

    result = auth_router.reset_password(
        ResetPasswordPayload(token=token, new_password="after-pass"),
        _request(),
        db_session,
    )

    db_session.refresh(user)
    assert result == {"message": "Password reset successful. You can now sign in."}
    assert verify_password("after-pass", user.hashed_password) is True


def test_reset_password_rejects_short_password(db_session):
    with pytest.raises(HTTPException) as exc:
        auth_router.reset_password(
            ResetPasswordPayload(token="bad", new_password="short"), _request(), db_session
        )

    assert exc.value.status_code == 400


def test_login_returns_bearer_token(db_session):
    user = User(
        email="login@example.com",
        username="loginuser",
        hashed_password=get_password_hash("valid-password"),
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    result = auth_router.login(
        request=_request(),
        form_data=OAuth2PasswordRequestForm(
            username="loginuser",
            password="valid-password",
            scope="",
            grant_type=None,
            client_id=None,
            client_secret=None,
        ),
        db=db_session,
    )

    assert result["token_type"] == "bearer"
    assert isinstance(result["access_token"], str)


def test_login_rejects_bad_password(db_session):
    user = User(
        email="badlogin@example.com",
        username="badlogin",
        hashed_password=get_password_hash("valid-password"),
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        auth_router.login(
            request=_request(),
            form_data=OAuth2PasswordRequestForm(
                username="badlogin",
                password="wrong-password",
                scope="",
                grant_type=None,
                client_id=None,
                client_secret=None,
            ),
            db=db_session,
        )

    assert exc.value.status_code == 401


def test_get_me_returns_current_user(user):
    assert auth_router.get_me(current_user=user).id == user.id


def test_reset_password_rejects_invalid_token(db_session):
    with pytest.raises(HTTPException) as exc:
        auth_router.reset_password(
            ResetPasswordPayload(token="missing-token", new_password="long-enough"),
            _request(),
            db_session,
        )

    assert exc.value.status_code == 400


def test_delete_me_removes_user_and_related_rows(
    db_session, user, garden, bed, planting, placement, sensor
):
    token = auth_router._issue_user_token(db_session, user.id, "email_verify", 30)
    db_session.add(
        SeedInventory(user_id=user.id, crop_name="Carrot", supplier="", quantity_packets=1)
    )
    db_session.commit()

    result = auth_router.delete_me(db=db_session, current_user=user)

    assert result == {"status": "deleted"}
    assert db_session.query(User).filter(User.id == user.id).first() is None
    assert (
        db_session.query(UserAuthToken)
        .filter(UserAuthToken.token_hash == auth_router._hash_token(token))
        .first()
        is None
    )


def test_resend_verification_returns_already_verified_for_verified_users(db_session, user):
    result = auth_router.resend_verification(request=_request(), current_user=user, db=db_session)

    assert result == {"message": "Email is already verified."}


def test_resend_verification_issues_new_token_for_unverified_user(db_session):
    user = User(
        email="pending@example.com",
        username="pending",
        hashed_password="hashed",
        email_verified=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    result = auth_router.resend_verification(request=_request(), current_user=user, db=db_session)

    assert result == {"message": "Verification email sent."}
    assert (
        db_session.query(UserAuthToken)
        .filter(UserAuthToken.user_id == user.id, UserAuthToken.purpose == "email_verify")
        .count()
        == 1
    )


@pytest.mark.real_email
def test_send_email_or_log_requires_smtp_in_production(monkeypatch):
    monkeypatch.setattr(auth_router.settings, "env", "production")
    monkeypatch.setattr(auth_router.settings, "smtp_host", "")

    with pytest.raises(RuntimeError):
        auth_router._send_email_or_log("to@example.com", "subject", "body")


@pytest.mark.real_email
def test_send_email_or_log_uses_smtp_when_configured(monkeypatch):
    sent = {}

    class DummySMTP:
        def __init__(self, host, port, timeout):
            sent["init"] = (host, port, timeout)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            sent["tls"] = True

        def login(self, username, password):
            sent["login"] = (username, password)

        def send_message(self, message):
            sent["message"] = (message["To"], message["Subject"])

    monkeypatch.setattr(auth_router, "smtplib", type("SMTPModule", (), {"SMTP": DummySMTP}))
    monkeypatch.setattr(auth_router.settings, "env", "development")
    monkeypatch.setattr(auth_router.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(auth_router.settings, "smtp_port", 587)
    monkeypatch.setattr(auth_router.settings, "smtp_use_tls", True)
    monkeypatch.setattr(auth_router.settings, "smtp_username", "user")
    monkeypatch.setattr(auth_router.settings, "smtp_password", "pass")

    auth_router._send_email_or_log("to@example.com", "subject", "body")

    assert sent["init"] == ("smtp.example.com", 587, 20)
    assert sent["tls"] is True
    assert sent["login"] == ("user", "pass")
    assert sent["message"] == ("to@example.com", "subject")
