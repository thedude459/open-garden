from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
import app.main as app_main
from app.routers import auth as auth_router_module
from app.routers import insights as insights_router_module
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


def _create_garden(
    client: TestClient, headers: dict[str, str], *, name: str = "Integration Garden"
):
    response = client.post(
        "/gardens",
        headers=headers,
        json={
            "name": name,
            "zip_code": "94110",
            "is_shared": False,
            "yard_width_ft": 10,
            "yard_length_ft": 10,
        },
    )
    assert response.status_code == 200
    return response.json()


def _create_bed(
    client: TestClient, headers: dict[str, str], garden_id: int, *, name: str = "Bed A"
):
    response = client.post(
        f"/gardens/{garden_id}/beds",
        headers=headers,
        json={"name": name, "width_in": 36, "height_in": 36, "grid_x": 0, "grid_y": 0},
    )
    assert response.status_code == 200
    return response.json()


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


def test_main_app_crop_template_crud_and_sensor_summary(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: None)

    token = _register_and_login(main_app_client, "sensors-main@example.com", "sensors-main")
    headers = _auth_headers(token)

    garden = _create_garden(main_app_client, headers, name="Sensors Garden")
    bed = _create_bed(main_app_client, headers, garden["id"], name="Sensor Bed")

    crop_create = main_app_client.post(
        "/crop-templates",
        headers=headers,
        json={
            "name": "Beet",
            "variety": "Detroit",
            "family": "Amaranthaceae",
            "spacing_in": 4,
            "days_to_harvest": 55,
            "planting_window": "Spring",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 4,
            "notes": "Root crop",
        },
    )
    assert crop_create.status_code == 200
    crop = crop_create.json()
    assert crop["name"] == "Beet (Detroit)"

    crop_list = main_app_client.get("/crop-templates", headers=headers)
    assert crop_list.status_code == 200
    assert any(item["id"] == crop["id"] for item in crop_list.json())

    crop_update = main_app_client.patch(
        f"/crop-templates/{crop['id']}",
        headers=headers,
        json={
            "name": "Beet",
            "variety": "Chioggia",
            "family": "Amaranthaceae",
            "spacing_in": 5,
            "days_to_harvest": 60,
            "planting_window": "Spring",
            "direct_sow": True,
            "frost_hardy": True,
            "weeks_to_transplant": 4,
            "notes": "Updated",
        },
    )
    assert crop_update.status_code == 200
    assert crop_update.json()["name"] == "Beet (Chioggia)"

    sync_status = main_app_client.get("/crop-templates/sync-status", headers=headers)
    assert sync_status.status_code == 200
    assert "status" in sync_status.json()
    assert "is_running" in sync_status.json()

    sensor_register = main_app_client.post(
        "/sensors/register",
        headers=headers,
        json={
            "garden_id": garden["id"],
            "bed_id": bed["id"],
            "name": " Moisture Probe ",
            "sensor_kind": "soil_moisture",
            "unit": " % ",
            "location_label": " row-1 ",
            "hardware_id": " hw-main-1 ",
        },
    )
    assert sensor_register.status_code == 200
    sensor = sensor_register.json()
    assert sensor["name"] == "Moisture Probe"
    assert sensor["unit"] == "%"

    single_reading = main_app_client.post(
        f"/sensors/{sensor['id']}/data",
        headers=headers,
        json={"value": 28.5, "captured_at": datetime.now(timezone.utc).isoformat()},
    )
    assert single_reading.status_code == 200
    assert single_reading.json()["sensor_id"] == sensor["id"]

    batch_reading = main_app_client.post(
        f"/sensors/{sensor['id']}/data/batch",
        headers=headers,
        json={
            "readings": [
                {"value": 26.0, "captured_at": datetime.now(timezone.utc).isoformat()},
                {"value": 24.0},
            ]
        },
    )
    assert batch_reading.status_code == 200
    assert batch_reading.json() == {"inserted": 2}

    summary = main_app_client.get(
        f"/gardens/{garden['id']}/sensors/summary",
        headers=headers,
        params={"hours": 48},
    )
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["garden_id"] == garden["id"]
    assert len(payload["sensors"]) == 1
    assert payload["soil_moisture_series"]


def test_main_app_insights_timeline_and_coach_flow(monkeypatch, main_app_client):
    monkeypatch.setattr(app_main, "global_rate_limit_hit", lambda request: None)

    async def fake_weather_failure(*args, **kwargs):
        raise httpx.RequestError("weather unavailable")

    monkeypatch.setattr(insights_router_module, "fetch_weather", fake_weather_failure)

    token = _register_and_login(main_app_client, "insights-main@example.com", "insights-main")
    headers = _auth_headers(token)

    garden = _create_garden(main_app_client, headers, name="Insights Garden")
    bed = _create_bed(main_app_client, headers, garden["id"], name="Insights Bed")

    planting = main_app_client.post(
        "/plantings",
        headers=headers,
        json={
            "garden_id": garden["id"],
            "bed_id": bed["id"],
            "crop_name": "Lettuce",
            "planted_on": str(date.today()),
            "source": "manual",
        },
    )
    assert planting.status_code == 200

    task = main_app_client.post(
        "/tasks",
        headers=headers,
        json={
            "garden_id": garden["id"],
            "title": "Water Lettuce",
            "due_on": str(date.today()),
            "notes": "integration",
        },
    )
    assert task.status_code == 200

    timeline = main_app_client.get(f"/gardens/{garden['id']}/timeline", headers=headers)
    assert timeline.status_code == 200
    timeline_payload = timeline.json()
    assert "events" in timeline_payload
    assert "counts_by_category" in timeline_payload

    coach = main_app_client.post(
        "/ai/coach",
        headers=headers,
        json={"garden_id": garden["id"], "message": "What should I focus on this week?"},
    )
    assert coach.status_code == 200
    coach_payload = coach.json()
    assert "reply" in coach_payload
    assert "suggested_actions" in coach_payload

    seasonal_plan = main_app_client.get(f"/gardens/{garden['id']}/plan/seasonal", headers=headers)
    assert seasonal_plan.status_code == 502
    assert seasonal_plan.json()["detail"] == "Unable to fetch forecast for seasonal planning."
