from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.sensors.engine import build_sensor_summary, compute_irrigation_suggestions


def test_compute_irrigation_suggestions_handles_missing_and_dry_data():
    missing = compute_irrigation_suggestions({"soil_moisture_series": [], "soil_temperature_series": []})
    dry = compute_irrigation_suggestions(
        {
            "soil_moisture_series": [{"value": 25.0}] * 3,
            "soil_temperature_series": [{"value": 84.0}],
        }
    )

    assert missing[0]["status"] == "monitor"
    assert dry[0]["status"] == "irrigate_now"
    assert dry[1]["title"] == "Heat-adjusted irrigation watch"


def test_build_sensor_summary_filters_series_and_reports_latest():
    now = datetime.now(timezone.utc)
    sensors = [
        SimpleNamespace(id=1, garden_id=1, bed_id=1, name="Moisture", sensor_kind="soil_moisture", unit="%", location_label="bed", hardware_id="m-1", is_active=True, created_at=now),
        SimpleNamespace(id=2, garden_id=1, bed_id=1, name="Temp", sensor_kind="soil_temperature", unit="F", location_label="bed", hardware_id="t-1", is_active=True, created_at=now),
    ]
    readings = [
        SimpleNamespace(sensor_id=1, value=28.0, captured_at=now - timedelta(hours=1)),
        SimpleNamespace(sensor_id=1, value=31.0, captured_at=now - timedelta(hours=3)),
        SimpleNamespace(sensor_id=2, value=70.0, captured_at=now - timedelta(hours=1)),
        SimpleNamespace(sensor_id=1, value=99.0, captured_at=now - timedelta(hours=72)),
    ]

    summary = build_sensor_summary(garden_id=1, sensors=sensors, readings=readings, horizon_hours=48)

    assert len(summary["soil_moisture_series"]) == 2
    assert summary["sensors"][0]["latest_value"] == 28.0
    assert summary["irrigation_suggestions"][0]["status"] in {"irrigate_now", "watch", "hold"}