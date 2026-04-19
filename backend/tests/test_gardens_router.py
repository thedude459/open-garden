import asyncio
from datetime import date

import httpx
import pytest
from fastapi import HTTPException

from app.core.exceptions import ValidationServiceError
from app.models import Garden, PestLog, Sensor, SensorReading, Task
from app.routers import gardens as gardens_router
from app.schemas import GardenCreate, GardenMicroclimateUpdate, GardenYardUpdate


def test_create_garden_uses_zip_profile_and_enforces_minimum_yard(monkeypatch, db_session, user):
    async def fake_fetch_zip_profile(zip_code):
        return {"zip_code": zip_code, "growing_zone": "10b", "latitude": 37.7, "longitude": -122.4}

    monkeypatch.setattr(gardens_router, "fetch_zip_profile", fake_fetch_zip_profile)

    created = asyncio.run(
        gardens_router.create_garden(
            GardenCreate(name="Home", zip_code="94110", yard_width_ft=2, yard_length_ft=3),
            db=db_session,
            current_user=user,
        )
    )

    assert created.yard_width_ft == 4
    assert created.yard_length_ft == 4


def test_create_garden_translates_zip_lookup_validation_error(monkeypatch, db_session, user):
    async def fake_fetch_zip_profile(zip_code):
        raise ValidationServiceError("bad zip")

    monkeypatch.setattr(gardens_router, "fetch_zip_profile", fake_fetch_zip_profile)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gardens_router.create_garden(
                GardenCreate(name="Home", zip_code="00000"), db=db_session, current_user=user
            )
        )

    assert exc.value.status_code == 400


def test_update_garden_microclimate_updates_only_passed_fields(db_session, garden):
    updated = gardens_router.update_garden_microclimate(
        GardenMicroclimateUpdate(sun_exposure="full_sun", edge_buffer_in=9),
        db=db_session,
        garden=garden,
    )

    assert updated.sun_exposure == "full_sun"
    assert updated.edge_buffer_in == 9


def test_geocode_garden_address_requires_saved_address(db_session, garden):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(gardens_router.geocode_garden_address(garden=garden, db=db_session))

    assert exc.value.status_code == 400


def test_get_garden_climate_translates_fetch_errors(monkeypatch, garden):
    async def fake_fetch_weather(*args, **kwargs):
        raise httpx.RequestError("boom")

    monkeypatch.setattr(gardens_router, "fetch_weather", fake_fetch_weather)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gardens_router.get_garden_climate(garden=garden))

    assert exc.value.status_code == 502


def test_list_my_gardens_returns_only_owned(db_session, user, other_user):
    mine = Garden(
        owner_id=user.id,
        name="Mine",
        description="",
        zip_code="94110",
        growing_zone="10b",
        yard_width_ft=20,
        yard_length_ft=20,
        latitude=37.7,
        longitude=-122.4,
        orientation="south",
        sun_exposure="part_sun",
        wind_exposure="moderate",
        thermal_mass="moderate",
        slope_position="mid",
        frost_pocket_risk="low",
        address_private="",
        is_shared=False,
        edge_buffer_in=6,
    )
    theirs = Garden(
        owner_id=other_user.id,
        name="Theirs",
        description="",
        zip_code="94110",
        growing_zone="10b",
        yard_width_ft=20,
        yard_length_ft=20,
        latitude=37.7,
        longitude=-122.4,
        orientation="south",
        sun_exposure="part_sun",
        wind_exposure="moderate",
        thermal_mass="moderate",
        slope_position="mid",
        frost_pocket_risk="low",
        address_private="",
        is_shared=False,
        edge_buffer_in=6,
    )
    db_session.add_all([mine, theirs])
    db_session.commit()

    items = gardens_router.list_my_gardens(db=db_session, current_user=user)

    assert [item.name for item in items] == ["Mine"]


def test_list_public_gardens_redacts_private_address(db_session, user):
    shared = Garden(
        owner_id=user.id,
        name="Shared",
        description="",
        zip_code="94110",
        growing_zone="10b",
        yard_width_ft=20,
        yard_length_ft=20,
        latitude=37.7,
        longitude=-122.4,
        orientation="south",
        sun_exposure="part_sun",
        wind_exposure="moderate",
        thermal_mass="moderate",
        slope_position="mid",
        frost_pocket_risk="low",
        address_private="123 Hidden St",
        is_shared=True,
        edge_buffer_in=6,
    )
    private = Garden(
        owner_id=user.id,
        name="Private",
        description="",
        zip_code="94110",
        growing_zone="10b",
        yard_width_ft=20,
        yard_length_ft=20,
        latitude=37.7,
        longitude=-122.4,
        orientation="south",
        sun_exposure="part_sun",
        wind_exposure="moderate",
        thermal_mass="moderate",
        slope_position="mid",
        frost_pocket_risk="low",
        address_private="456 Secret Ave",
        is_shared=False,
        edge_buffer_in=6,
    )
    db_session.add_all([shared, private])
    db_session.commit()

    items = gardens_router.list_public_gardens(db=db_session)

    assert [item.name for item in items] == ["Shared"]
    assert items[0].address_private == ""


def test_geocode_garden_address_updates_coordinates(monkeypatch, db_session, garden):
    garden.address_private = "123 Main St"
    garden.zip_code = "94110"
    db_session.add(garden)
    db_session.commit()

    called = {}

    async def fake_fetch_address_geocode(address, zip_code=None):
        called["address"] = address
        called["zip_code"] = zip_code
        return {"latitude": 40.1, "longitude": -74.2, "display_name": "123 Main St"}

    monkeypatch.setattr(gardens_router, "fetch_address_geocode", fake_fetch_address_geocode)

    updated = asyncio.run(gardens_router.geocode_garden_address(garden=garden, db=db_session))

    assert updated.latitude == 40.1
    assert updated.longitude == -74.2
    assert called == {"address": "123 Main St", "zip_code": "94110"}


def test_geocode_garden_address_translates_validation_error(monkeypatch, db_session, garden):
    garden.address_private = "bad"
    garden.zip_code = "94110"
    db_session.add(garden)
    db_session.commit()

    async def fake_fetch_address_geocode(address, zip_code=None):
        raise ValidationServiceError("invalid address")

    monkeypatch.setattr(gardens_router, "fetch_address_geocode", fake_fetch_address_geocode)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gardens_router.geocode_garden_address(garden=garden, db=db_session))

    assert exc.value.status_code == 400


def test_update_garden_yard_applies_minimum_dimensions(db_session, garden):
    updated = gardens_router.update_garden_yard(
        GardenYardUpdate(yard_width_ft=1, yard_length_ft=2), db=db_session, garden=garden
    )

    assert updated.yard_width_ft == 4
    assert updated.yard_length_ft == 4


def test_suggest_garden_microclimate_success(monkeypatch, garden):
    async def fake_fetch_microclimate_signals(latitude, longitude):
        return {
            "suggestions": {
                "sun_exposure": "full_sun",
                "wind_exposure": "moderate",
                "slope_position": "mid",
                "frost_pocket_risk": "low",
            },
            "notes": {
                "sun_exposure": "sun note",
                "wind_exposure": "wind note",
                "slope_position": "slope note",
                "frost_pocket_risk": "frost note",
                "orientation": "orientation note",
                "thermal_mass": "thermal note",
            },
        }

    monkeypatch.setattr(
        gardens_router, "fetch_microclimate_signals", fake_fetch_microclimate_signals
    )

    result = asyncio.run(gardens_router.suggest_garden_microclimate(garden=garden))

    assert result.sun_exposure.value == "full_sun"
    assert result.orientation.value is None
    assert result.thermal_mass.note == "thermal note"


def test_suggest_garden_microclimate_translates_errors(monkeypatch, garden):
    async def fake_fetch_microclimate_signals(latitude, longitude):
        raise httpx.RequestError("boom")

    monkeypatch.setattr(
        gardens_router, "fetch_microclimate_signals", fake_fetch_microclimate_signals
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gardens_router.suggest_garden_microclimate(garden=garden))

    assert exc.value.status_code == 502


def test_get_garden_climate_returns_summary(monkeypatch, garden):
    async def fake_fetch_weather(*args, **kwargs):
        return {"daily": {}}

    monkeypatch.setattr(gardens_router, "fetch_weather", fake_fetch_weather)
    monkeypatch.setattr(
        gardens_router,
        "build_climate_summary",
        lambda garden, weather: {"zone": garden.growing_zone, "ok": True},
    )

    result = asyncio.run(gardens_router.get_garden_climate(garden=garden))

    assert result == {"zone": "10b", "ok": True}


def test_get_planting_windows_success_and_failure(monkeypatch, db_session, garden):
    async def fake_fetch_weather(*args, **kwargs):
        return {"daily": {}}

    monkeypatch.setattr(gardens_router, "fetch_weather", fake_fetch_weather)
    monkeypatch.setattr(
        gardens_router,
        "build_dynamic_planting_windows",
        lambda garden, weather, crop_templates: {"windows": [{"crop_name": "Lettuce"}]},
    )

    success = asyncio.run(
        gardens_router.get_garden_climate_planting_windows(db=db_session, garden=garden)
    )

    assert success["windows"][0]["crop_name"] == "Lettuce"

    async def failing_fetch_weather(*args, **kwargs):
        raise httpx.RequestError("boom")

    monkeypatch.setattr(gardens_router, "fetch_weather", failing_fetch_weather)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gardens_router.get_garden_climate_planting_windows(db=db_session, garden=garden)
        )

    assert exc.value.status_code == 502


def test_get_garden_layout_sun_path_uses_default_and_explicit_date(monkeypatch, garden):
    monkeypatch.setattr(
        gardens_router,
        "build_garden_sun_path",
        lambda g, target_date: {"garden_id": g.id, "target_date": target_date},
    )

    default_result = gardens_router.get_garden_layout_sun_path(garden=garden)
    explicit_result = gardens_router.get_garden_layout_sun_path(
        on_date=date(2026, 4, 4), garden=garden
    )

    assert "target_date" in default_result
    assert explicit_result["target_date"] == date(2026, 4, 4)


def test_delete_garden_cleans_related_rows(
    db_session, garden, planting, task, sensor, sensor_reading
):
    reading_id = sensor_reading.id
    db_session.add(
        PestLog(
            garden_id=garden.id,
            title="Aphids",
            observed_on=date.today(),
            treatment="Soap",
            photo_path="",
        )
    )
    db_session.commit()

    result = gardens_router.delete_garden(db=db_session, garden=garden)

    assert result == {"status": "deleted"}
    assert db_session.query(Garden).filter(Garden.id == garden.id).first() is None
    assert db_session.query(Task).filter(Task.garden_id == garden.id).count() == 0
    assert db_session.query(Sensor).filter(Sensor.garden_id == garden.id).count() == 0
    assert db_session.query(SensorReading).filter(SensorReading.id == reading_id).count() == 0


def test_garden_extension_resources_uses_state_from_zip(monkeypatch, garden):
    async def fake_fetch_zip_profile(zip_code):
        return {
            "zip_code": zip_code,
            "state_code": "CO",
            "latitude": 40.0,
            "longitude": -105.0,
            "growing_zone": "6a",
        }

    monkeypatch.setattr(gardens_router, "fetch_zip_profile", fake_fetch_zip_profile)

    result = asyncio.run(gardens_router.garden_extension_resources(garden=garden))

    assert result["state_code"] == "CO"
    assert "colostate.edu" in result["home_url"]
    assert result["zip_code"] == garden.zip_code
