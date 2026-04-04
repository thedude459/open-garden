from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core import auth
from app.models import User


def test_password_hash_round_trip():
    hashed = auth.get_password_hash("super-secret")

    assert hashed != "super-secret"
    assert auth.verify_password("super-secret", hashed) is True
    assert auth.verify_password("wrong", hashed) is False


def test_create_access_token_contains_subject_and_future_expiry():
    token = auth.create_access_token("tester")
    payload = jwt.decode(token, auth.settings.secret_key, algorithms=[auth.settings.algorithm])

    assert payload["sub"] == "tester"
    assert datetime.fromtimestamp(payload["exp"], tz=timezone.utc) > datetime.now(timezone.utc)


def test_get_current_user_returns_active_user(db_session, user):
    token = auth.create_access_token(user.username)

    result = auth.get_current_user(token=token, db=db_session)

    assert result.id == user.id


def test_get_current_user_rejects_invalid_token(db_session):
    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(token="not-a-token", db=db_session)

    assert exc.value.status_code == 401


def test_get_current_user_rejects_expired_token(db_session, user):
    token = jwt.encode(
        {"sub": user.username, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        auth.settings.secret_key,
        algorithm=auth.settings.algorithm,
    )

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(token=token, db=db_session)

    assert exc.value.status_code == 401


def test_get_current_user_rejects_inactive_user(db_session, user):
    user.is_active = False
    db_session.add(user)
    db_session.commit()
    token = auth.create_access_token(user.username)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(token=token, db=db_session)

    assert exc.value.status_code == 401


def test_get_admin_user_allows_admin(admin_user):
    assert auth.get_admin_user(current_user=admin_user).id == admin_user.id


def test_get_admin_user_rejects_non_admin(user):
    with pytest.raises(HTTPException) as exc:
        auth.get_admin_user(current_user=user)

    assert exc.value.status_code == 403


def test_get_current_user_rejects_missing_subject(db_session):
    token = jwt.encode(
        {"exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        auth.settings.secret_key,
        algorithm=auth.settings.algorithm,
    )

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(token=token, db=db_session)

    assert exc.value.status_code == 401


def test_get_current_user_rejects_unknown_user(db_session):
    token = auth.create_access_token("ghost")

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(token=token, db=db_session)

    assert exc.value.status_code == 401