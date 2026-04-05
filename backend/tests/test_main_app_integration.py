from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
import app.main as app_main
from app.routers import auth as auth_router_module
from app.routers import gardens as gardens_router_module


pytestmark = pytest.mark.integration


@pytest.fixture()
def main_app_client(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    @asynccontextmanager
    async def no_op_lifespan(_app):
        yield

    monkeypatch.setattr(app.router, "lifespan_context", no_op_lifespan)
    monkeypatch.setattr(auth_router_module, "_send_email_or_log", lambda *args, **kwargs: None)

    async def fake_fetch_zip_profile(zip_code: str):
        return {
            "zip_code": zip_code,
            "growing_zone": "10b",
            "latitude": 37.7,
            "longitude": -122.4,
        }

    monkeypatch.setattr(gardens_router_module, "fetch_zip_profile", fake_fetch_zip_profile)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_health_endpoint_sets_security_headers(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: None)

    response = main_app_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == "geolocation=(), microphone=(), camera=()"
    assert "Strict-Transport-Security" not in response.headers


def test_global_rate_limit_returns_429_with_retry_after(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: 7)

    response = main_app_client.get("/health")

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "7"
    assert response.json() == {"detail": "Too many requests. Please slow down."}


def test_auth_paths_are_marked_no_store(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: None)

    response = main_app_client.post("/auth/login", data={"username": "u", "password": "p"})

    assert response.status_code == 401
    assert response.headers["Cache-Control"] == "no-store"


def _register_and_login(client: TestClient, email: str, username: str) -> str:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "password123"},
    )
    assert register.status_code == 200

    login = client.post(
        "/auth/login",
        data={"username": username, "password": "password123"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_full_app_auth_and_ownership_guardrails(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: None)

    no_token = main_app_client.get("/users/me")
    assert no_token.status_code == 401

    owner_token = _register_and_login(main_app_client, "owner-main@example.com", "owner-main")
    intruder_token = _register_and_login(
        main_app_client, "intruder-main@example.com", "intruder-main"
    )

    owner_headers = _auth_headers(owner_token)
    intruder_headers = _auth_headers(intruder_token)

    garden_create = main_app_client.post(
        "/gardens",
        headers=owner_headers,
        json={
            "name": "Owner Only Garden",
            "zip_code": "94110",
            "is_shared": False,
            "yard_width_ft": 10,
            "yard_length_ft": 10,
        },
    )
    assert garden_create.status_code == 200
    garden_id = garden_create.json()["id"]

    public_gardens = main_app_client.get("/gardens/public")
    assert public_gardens.status_code == 200
    assert public_gardens.json() == []

    forbidden_bed = main_app_client.post(
        f"/gardens/{garden_id}/beds",
        headers=intruder_headers,
        json={"name": "Intruder Bed", "width_in": 24, "height_in": 24, "grid_x": 0, "grid_y": 0},
    )
    assert forbidden_bed.status_code == 404
    assert forbidden_bed.json()["detail"] == "Garden not found"
