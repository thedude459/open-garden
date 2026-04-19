from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import Base
from app.routers import auth_router, gardens_router, planner_router, tasks_router
from app.routers import auth as auth_module
from app.routers import gardens as gardens_module


pytestmark = pytest.mark.integration


@pytest.fixture()
def integration_client(monkeypatch):
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

    async def fake_fetch_zip_profile(zip_code: str):
        return {
            "zip_code": zip_code,
            "growing_zone": "10b",
            "latitude": 37.7,
            "longitude": -122.4,
        }

    monkeypatch.setattr(auth_module, "enforce_rate_limit", lambda *args, **kwargs: None)
    monkeypatch.setattr(auth_module, "_send_email_or_log", lambda *args, **kwargs: None)
    monkeypatch.setattr(gardens_module, "fetch_zip_profile", fake_fetch_zip_profile)

    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(gardens_router)
    app.include_router(planner_router)
    app.include_router(tasks_router)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, TestingSessionLocal

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _register_and_login(
    client: TestClient,
    *,
    email: str,
    username: str,
    password: str = "password123",
) -> str:
    register_response = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register_response.status_code == 200
    registered_user = register_response.json()
    assert registered_user["email"] == email
    assert registered_user["username"] == username
    assert registered_user["email_verified"] is False

    login_response = client.post(
        "/auth/login",
        data={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["token_type"] == "bearer"
    assert isinstance(login_payload["access_token"], str)
    assert login_payload["access_token"]
    return login_payload["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_full_planner_workflow_via_http_endpoints(integration_client):
    client, _ = integration_client
    token = _register_and_login(
        client,
        email="planner@example.com",
        username="planner-user",
    )
    headers = _auth_headers(token)

    garden_response = client.post(
        "/gardens",
        headers=headers,
        json={
            "name": "Backyard",
            "zip_code": "94110",
            "address_private": "123 Hidden St",
            "is_shared": True,
            "yard_width_ft": 10,
            "yard_length_ft": 10,
        },
    )
    assert garden_response.status_code == 200
    garden = garden_response.json()
    assert garden["name"] == "Backyard"
    assert garden["zip_code"] == "94110"
    assert garden["owner_id"]

    public_response = client.get("/gardens/public")
    assert public_response.status_code == 200
    assert public_response.json()[0]["name"] == "Backyard"
    assert public_response.json()[0]["address_private"] == ""

    bed_response = client.post(
        f"/gardens/{garden['id']}/beds",
        headers=headers,
        json={"name": "North Bed", "width_in": 48, "height_in": 36, "grid_x": 0, "grid_y": 0},
    )
    assert bed_response.status_code == 200
    bed = bed_response.json()
    assert bed["name"] == "North Bed"
    assert bed["garden_id"] == garden["id"]

    rename_bed_response = client.patch(
        f"/beds/{bed['id']}",
        headers=headers,
        json={"name": "Kitchen Bed"},
    )
    assert rename_bed_response.status_code == 200
    bed = rename_bed_response.json()
    assert bed["name"] == "Kitchen Bed"

    planting_response = client.post(
        "/plantings",
        headers=headers,
        json={
            "garden_id": garden["id"],
            "bed_id": bed["id"],
            "crop_name": "Carrot",
            "grid_x": 2,
            "grid_y": 2,
            "color": "#57a773",
            "planted_on": str(date.today()),
            "method": "direct_seed",
            "location": "in_bed",
            "source": "manual",
        },
    )
    assert planting_response.status_code == 200
    planting = planting_response.json()
    assert planting["garden_id"] == garden["id"]
    assert planting["bed_id"] == bed["id"]
    assert planting["crop_name"] == "Carrot"
    assert planting["grid_x"] == 2
    assert planting["grid_y"] == 2
    assert planting["method"] == "direct_seed"
    assert planting["location"] == "in_bed"
    assert planting["source"] == "manual"

    task_list_response = client.get(
        "/tasks",
        headers=headers,
        params={"garden_id": garden["id"], "q": "carrot"},
    )
    assert task_list_response.status_code == 200
    tasks = task_list_response.json()
    assert len(tasks) >= 1

    task_id = tasks[0]["id"]
    task_update_response = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"is_done": True},
    )
    assert task_update_response.status_code == 200
    assert task_update_response.json()["id"] == task_id
    assert task_update_response.json()["is_done"] is True

    task_delete_response = client.delete(f"/tasks/{task_id}", headers=headers)
    assert task_delete_response.status_code == 204

    seed_add_response = client.post(
        "/seed-inventory",
        headers=headers,
        json={"crop_name": "Carrot", "supplier": "Johnny's", "quantity_packets": 2},
    )
    assert seed_add_response.status_code == 200
    seed_item = seed_add_response.json()
    assert seed_item["crop_name"] == "Carrot"
    assert seed_item["quantity_packets"] == 2

    seed_list_response = client.get("/seed-inventory", headers=headers)
    assert seed_list_response.status_code == 200
    assert len(seed_list_response.json()) == 1
    assert seed_list_response.json()[0]["supplier"] == "Johnny's"

    pest_create_response = client.post(
        "/pest-logs",
        headers=headers,
        json={
            "garden_id": garden["id"],
            "title": "Aphids",
            "observed_on": str(date.today()),
            "treatment": "Soap",
        },
    )
    assert pest_create_response.status_code == 200
    pest_log_id = pest_create_response.json()["id"]
    assert pest_create_response.json()["title"] == "Aphids"

    pest_list_response = client.get(
        "/pest-logs",
        headers=headers,
        params={"garden_id": garden["id"]},
    )
    assert pest_list_response.status_code == 200
    assert len(pest_list_response.json()) == 1
    assert pest_list_response.json()[0]["id"] == pest_log_id

    pest_delete_response = client.delete(f"/pest-logs/{pest_log_id}", headers=headers)
    assert pest_delete_response.status_code == 200

    garden_delete_response = client.delete(f"/gardens/{garden['id']}", headers=headers)
    assert garden_delete_response.status_code == 200
    assert garden_delete_response.json() == {"status": "deleted"}

    my_gardens_response = client.get("/gardens", headers=headers)
    assert my_gardens_response.status_code == 200
    assert my_gardens_response.json() == []


def test_cross_user_authorization_is_enforced(integration_client):
    client, _ = integration_client

    owner_token = _register_and_login(
        client,
        email="owner@example.com",
        username="owner",
    )
    owner_headers = _auth_headers(owner_token)

    stranger_token = _register_and_login(
        client,
        email="stranger@example.com",
        username="stranger",
    )
    stranger_headers = _auth_headers(stranger_token)

    garden_response = client.post(
        "/gardens",
        headers=owner_headers,
        json={"name": "Private Garden", "zip_code": "94110"},
    )
    assert garden_response.status_code == 200
    garden_id = garden_response.json()["id"]

    forbidden_bed_response = client.post(
        f"/gardens/{garden_id}/beds",
        headers=stranger_headers,
        json={"name": "Hack Bed", "width_in": 24, "height_in": 24, "grid_x": 0, "grid_y": 0},
    )
    assert forbidden_bed_response.status_code == 404
    assert forbidden_bed_response.json()["detail"] == "Garden not found"

    owner_task_response = client.post(
        "/tasks",
        headers=owner_headers,
        json={
            "garden_id": garden_id,
            "title": "Water",
            "due_on": str(date.today()),
            "notes": "owner task",
        },
    )
    assert owner_task_response.status_code == 200
    task_id = owner_task_response.json()["id"]
    assert owner_task_response.json()["title"] == "Water"

    stranger_read_response = client.get(
        "/tasks",
        headers=stranger_headers,
        params={"garden_id": garden_id},
    )
    assert stranger_read_response.status_code == 404
    assert stranger_read_response.json()["detail"] == "Garden not found"

    stranger_update_response = client.patch(
        f"/tasks/{task_id}",
        headers=stranger_headers,
        json={"is_done": True},
    )
    assert stranger_update_response.status_code == 403
    assert stranger_update_response.json()["detail"] == "Not authorized"


def test_geocode_endpoint_uses_street_address_plus_zip(integration_client, monkeypatch):
    client, _ = integration_client
    token = _register_and_login(
        client,
        email="geo@example.com",
        username="geo-user",
    )
    headers = _auth_headers(token)

    garden_response = client.post(
        "/gardens",
        headers=headers,
        json={
            "name": "Geo Garden",
            "zip_code": "94110",
            "address_private": "123 Main St",
        },
    )
    assert garden_response.status_code == 200
    garden = garden_response.json()

    called = {}

    async def fake_fetch_address_geocode(address: str, zip_code: str | None = None):
        called["address"] = address
        called["zip_code"] = zip_code
        return {"latitude": 40.1, "longitude": -74.2, "display_name": "123 Main St, 94110"}

    monkeypatch.setattr(gardens_module, "fetch_address_geocode", fake_fetch_address_geocode)

    geocode_response = client.patch(f"/gardens/{garden['id']}/geocode", headers=headers)
    assert geocode_response.status_code == 200
    geocoded = geocode_response.json()
    assert geocoded["latitude"] == 40.1
    assert geocoded["longitude"] == -74.2
    assert called == {"address": "123 Main St", "zip_code": "94110"}


def test_invalid_or_missing_auth_token_is_rejected(integration_client):
    client, _ = integration_client

    no_token_response = client.get("/users/me")
    assert no_token_response.status_code == 401
    assert no_token_response.json()["detail"] == "Not authenticated"

    bad_token_response = client.get(
        "/users/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert bad_token_response.status_code == 401
    assert bad_token_response.json()["detail"] == "Could not validate credentials"
