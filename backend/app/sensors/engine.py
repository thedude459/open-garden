from datetime import datetime, timedelta, timezone


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _aggregate_series(
    readings: list, sensors_by_id: dict[int, object], kind: str, horizon_hours: int
) -> list[dict]:
    cutoff = _utc_now() - timedelta(hours=max(1, horizon_hours))
    points = []
    for reading in readings:
        sensor = sensors_by_id.get(reading.sensor_id)
        if sensor is None or sensor.sensor_kind != kind:
            continue
        captured_at = _as_utc(reading.captured_at)
        if captured_at < cutoff:
            continue
        points.append(
            {
                "sensor_id": sensor.id,
                "sensor_name": sensor.name,
                "captured_at": captured_at,
                "value": float(reading.value),
                "unit": sensor.unit,
            }
        )
    points.sort(key=lambda item: item["captured_at"])
    return points[-240:]


def compute_irrigation_suggestions(summary: dict) -> list[dict]:
    suggestions: list[dict] = []
    moisture = summary["soil_moisture_series"]
    temp = summary["soil_temperature_series"]

    avg_moisture = (
        sum(point["value"] for point in moisture[-8:]) / max(1, len(moisture[-8:]))
        if moisture
        else None
    )
    recent_temp = temp[-1]["value"] if temp else None

    if avg_moisture is None:
        suggestions.append(
            {
                "status": "monitor",
                "title": "No moisture telemetry yet",
                "detail": "Register a soil moisture probe and ingest readings to unlock irrigation automation.",
            }
        )
        return suggestions

    if avg_moisture < 30:
        suggestions.append(
            {
                "status": "irrigate_now",
                "title": "Irrigation recommended now",
                "detail": f"Average soil moisture is {avg_moisture:.1f}%. Trigger a watering cycle and re-check in 30-60 minutes.",
            }
        )
    elif avg_moisture < 40:
        suggestions.append(
            {
                "status": "watch",
                "title": "Moisture trending dry",
                "detail": f"Average soil moisture is {avg_moisture:.1f}%. Prepare irrigation if the next reading drops below 30%.",
            }
        )
    else:
        suggestions.append(
            {
                "status": "hold",
                "title": "Moisture in safe range",
                "detail": f"Average soil moisture is {avg_moisture:.1f}%. Delay irrigation to avoid overwatering.",
            }
        )

    if recent_temp is not None and recent_temp >= 82 and avg_moisture < 45:
        suggestions.append(
            {
                "status": "watch",
                "title": "Heat-adjusted irrigation watch",
                "detail": "Soil temperature is elevated. Check moisture more frequently during hot periods.",
            }
        )

    return suggestions


def build_sensor_summary(
    garden_id: int, sensors: list, readings: list, horizon_hours: int = 48
) -> dict:
    sensors_sorted = sorted(
        sensors, key=lambda item: (item.sensor_kind, item.name.lower(), item.id)
    )
    sensors_by_id = {sensor.id: sensor for sensor in sensors_sorted}

    latest_by_sensor: dict[int, object] = {}
    for reading in sorted(readings, key=lambda item: _as_utc(item.captured_at), reverse=True):
        if reading.sensor_id not in latest_by_sensor:
            latest_by_sensor[reading.sensor_id] = reading

    sensor_rows = []
    for sensor in sensors_sorted:
        latest = latest_by_sensor.get(sensor.id)
        sensor_rows.append(
            {
                "id": sensor.id,
                "garden_id": sensor.garden_id,
                "bed_id": sensor.bed_id,
                "name": sensor.name,
                "sensor_kind": sensor.sensor_kind,
                "unit": sensor.unit,
                "location_label": sensor.location_label,
                "hardware_id": sensor.hardware_id,
                "is_active": sensor.is_active,
                "created_at": sensor.created_at,
                "latest_value": float(latest.value) if latest else None,
                "latest_captured_at": latest.captured_at if latest else None,
            }
        )

    soil_moisture_series = _aggregate_series(
        readings, sensors_by_id, "soil_moisture", horizon_hours
    )
    soil_temperature_series = _aggregate_series(
        readings, sensors_by_id, "soil_temperature", horizon_hours
    )

    payload = {
        "generated_at": _utc_now(),
        "garden_id": garden_id,
        "horizon_hours": horizon_hours,
        "sensors": sensor_rows,
        "soil_moisture_series": soil_moisture_series,
        "soil_temperature_series": soil_temperature_series,
    }
    payload["irrigation_suggestions"] = compute_irrigation_suggestions(payload)
    return payload
