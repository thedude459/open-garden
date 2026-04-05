import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import HTTPException

from app.models import Sensor, SensorReading
from app.routers import insights


def test_ai_coach_returns_generated_response(monkeypatch, db_session, garden, user):
    async def fake_fetch_weather(*args, **kwargs):
        return {"daily": {}}

    monkeypatch.setattr(insights, "fetch_weather", fake_fetch_weather)
    monkeypatch.setattr(
        insights,
        "build_sensor_summary",
        lambda **kwargs: {
            "sensors": [],
            "soil_moisture_series": [],
            "soil_temperature_series": [],
            "irrigation_suggestions": [],
        },
    )
    monkeypatch.setattr(insights, "build_coach_context", lambda **kwargs: {"context": True})
    monkeypatch.setattr(
        insights,
        "generate_coach_response",
        lambda context: {
            "reply": "ok",
            "context_highlights": [],
            "suggested_actions": [],
            "scenario_outcomes": [],
        },
    )

    result = asyncio.run(
        insights.ai_coach(
            payload=type(
                "Payload", (), {"garden_id": garden.id, "message": "Help", "scenario": None}
            )(),
            db=db_session,
            current_user=user,
        )
    )

    assert result["reply"] == "ok"


def test_get_garden_seasonal_plan_translates_weather_errors(monkeypatch, db_session, garden, user):
    async def fake_fetch_weather(*args, **kwargs):
        raise httpx.RequestError("boom")

    monkeypatch.setattr(insights, "fetch_weather", fake_fetch_weather)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            insights.get_garden_seasonal_plan(garden_id=garden.id, db=db_session, current_user=user)
        )

    assert exc.value.status_code == 502


def test_ai_coach_rejects_missing_garden(db_session, user):
    payload = type("Payload", (), {"garden_id": 999, "message": "Help", "scenario": None})()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(insights.ai_coach(payload=payload, db=db_session, current_user=user))

    assert exc.value.status_code == 404


def test_ai_coach_weather_failure_uses_none_and_reads_sensor_history(
    monkeypatch, db_session, garden, user
):
    sensor = Sensor(
        garden_id=garden.id,
        bed_id=None,
        name="Probe",
        sensor_kind="soil_moisture",
        unit="%",
        location_label="",
        hardware_id="probe-1",
        is_active=True,
    )
    db_session.add(sensor)
    db_session.commit()
    db_session.refresh(sensor)

    recent = SensorReading(
        sensor_id=sensor.id, value=22.0, captured_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    stale = SensorReading(
        sensor_id=sensor.id,
        value=10.0,
        captured_at=datetime.now(timezone.utc) - timedelta(hours=100),
    )
    db_session.add_all([recent, stale])
    db_session.commit()

    async def failing_weather(*args, **kwargs):
        raise httpx.RequestError("boom")

    seen = {}

    def fake_build_sensor_summary(**kwargs):
        seen["reading_count"] = len(kwargs["readings"])
        return {"irrigation_suggestions": []}

    def fake_build_coach_context(**kwargs):
        seen["weather"] = kwargs["weather"]
        return {"context": True}

    monkeypatch.setattr(insights, "fetch_weather", failing_weather)
    monkeypatch.setattr(insights, "build_sensor_summary", fake_build_sensor_summary)
    monkeypatch.setattr(insights, "build_coach_context", fake_build_coach_context)
    monkeypatch.setattr(
        insights,
        "generate_coach_response",
        lambda context: {
            "reply": "ok",
            "context_highlights": [],
            "suggested_actions": [],
            "scenario_outcomes": [],
        },
    )

    payload = type("Payload", (), {"garden_id": garden.id, "message": "Help", "scenario": None})()
    result = asyncio.run(insights.ai_coach(payload=payload, db=db_session, current_user=user))

    assert result["reply"] == "ok"
    assert seen["weather"] is None
    assert seen["reading_count"] == 1


def test_get_garden_timeline_not_found(db_session, user):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(insights.get_garden_timeline(garden_id=999, db=db_session, current_user=user))

    assert exc.value.status_code == 404


def test_get_garden_timeline_uses_empty_windows_when_weather_unavailable(
    monkeypatch, db_session, garden, user
):
    async def failing_weather(*args, **kwargs):
        raise httpx.RequestError("boom")

    captured = {}

    def fake_unified_timeline(**kwargs):
        captured["windows"] = kwargs["planting_windows"]
        captured["weather"] = kwargs["weather"]
        return {
            "generated_at": datetime.now(timezone.utc),
            "events": [],
            "counts_by_category": {
                "task": 0,
                "weather": 0,
                "planting_window": 0,
                "sensor_alert": 0,
                "ai_recommendation": 0,
            },
        }

    monkeypatch.setattr(insights, "fetch_weather", failing_weather)
    monkeypatch.setattr(
        insights, "build_sensor_summary", lambda **kwargs: {"irrigation_suggestions": []}
    )
    monkeypatch.setattr(insights, "build_coach_context", lambda **kwargs: {"context": True})
    monkeypatch.setattr(
        insights,
        "generate_coach_response",
        lambda context: {
            "reply": "ok",
            "context_highlights": [],
            "suggested_actions": [],
            "scenario_outcomes": [],
        },
    )
    monkeypatch.setattr(insights, "build_unified_timeline", fake_unified_timeline)

    result = asyncio.run(
        insights.get_garden_timeline(garden_id=garden.id, db=db_session, current_user=user)
    )

    assert result["events"] == []
    assert captured["windows"] == {"windows": []}
    assert captured["weather"] is None


def test_get_garden_timeline_builds_windows_when_weather_available(
    monkeypatch, db_session, garden, user
):
    async def ok_weather(*args, **kwargs):
        return {"daily": {}}

    monkeypatch.setattr(insights, "fetch_weather", ok_weather)
    monkeypatch.setattr(
        insights,
        "build_dynamic_planting_windows",
        lambda garden, weather, crop_templates: {"windows": [{"crop_name": "Spinach"}]},
    )
    monkeypatch.setattr(
        insights, "build_sensor_summary", lambda **kwargs: {"irrigation_suggestions": []}
    )
    monkeypatch.setattr(insights, "build_coach_context", lambda **kwargs: {"context": True})
    monkeypatch.setattr(
        insights,
        "generate_coach_response",
        lambda context: {
            "reply": "ok",
            "context_highlights": [],
            "suggested_actions": [],
            "scenario_outcomes": [],
        },
    )
    monkeypatch.setattr(
        insights,
        "build_unified_timeline",
        lambda **kwargs: {
            "generated_at": datetime.now(timezone.utc),
            "events": [{"title": "x"}],
            "counts_by_category": {
                "task": 0,
                "weather": 0,
                "planting_window": 1,
                "sensor_alert": 0,
                "ai_recommendation": 0,
            },
        },
    )

    result = asyncio.run(
        insights.get_garden_timeline(garden_id=garden.id, db=db_session, current_user=user)
    )

    assert result["counts_by_category"]["planting_window"] == 1


def test_get_garden_seasonal_plan_not_found(db_session, user):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            insights.get_garden_seasonal_plan(garden_id=999, db=db_session, current_user=user)
        )

    assert exc.value.status_code == 404


def test_get_garden_seasonal_plan_success(monkeypatch, db_session, garden, user):
    async def ok_weather(*args, **kwargs):
        return {"daily": {}}

    monkeypatch.setattr(insights, "fetch_weather", ok_weather)
    monkeypatch.setattr(
        insights,
        "build_seasonal_plan",
        lambda garden, weather, crop_templates, plantings: {"garden_id": garden.id, "ok": True},
    )

    result = asyncio.run(
        insights.get_garden_seasonal_plan(garden_id=garden.id, db=db_session, current_user=user)
    )

    assert result == {"garden_id": garden.id, "ok": True}
