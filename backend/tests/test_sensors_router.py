from datetime import datetime

import pytest
from fastapi import HTTPException

from app.models import Sensor
from app.routers.sensors import get_garden_sensor_summary, ingest_sensor_data, ingest_sensor_data_batch, register_sensor
from app.schemas import SensorDataBatchCreate, SensorDataCreate, SensorRegister


def test_register_sensor_creates_trimmed_sensor(db_session, user, garden, bed):
    created = register_sensor(
        SensorRegister(garden_id=garden.id, bed_id=bed.id, name=" Probe ", sensor_kind="soil_moisture", unit=" % ", location_label=" row 1 ", hardware_id=" hw-1 "),
        db=db_session,
        current_user=user,
    )

    assert created.name == "Probe"
    assert created.unit == "%"
    assert created.hardware_id == "hw-1"


def test_register_sensor_rejects_missing_bed(db_session, user, garden):
    with pytest.raises(HTTPException) as exc:
        register_sensor(
            SensorRegister(garden_id=garden.id, bed_id=999, name="Probe", sensor_kind="soil_moisture"),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 404


def test_register_sensor_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        register_sensor(SensorRegister(garden_id=999, name="Probe", sensor_kind="soil_moisture"), db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_ingest_sensor_data_normalizes_naive_timestamp(db_session, sensor):
    created = ingest_sensor_data(SensorDataCreate(value=30.5, captured_at=datetime(2026, 4, 1, 8, 0, 0)), db=db_session, sensor=sensor)

    assert created.captured_at == datetime(2026, 4, 1, 8, 0, 0)


def test_ingest_sensor_data_batch_rejects_large_batch(db_session, sensor):
    payload = SensorDataBatchCreate(readings=[SensorDataCreate(value=float(index)) for index in range(501)])

    with pytest.raises(HTTPException) as exc:
        ingest_sensor_data_batch(payload, db=db_session, sensor=sensor)

    assert exc.value.status_code == 422


def test_ingest_sensor_data_batch_inserts_rows(db_session, sensor):
    result = ingest_sensor_data_batch(
        SensorDataBatchCreate(readings=[SensorDataCreate(value=10.0), SensorDataCreate(value=11.0)]),
        db=db_session,
        sensor=sensor,
    )

    assert result == {"inserted": 2}


def test_garden_sensor_summary_returns_current_reading_context(db_session, garden, sensor, sensor_reading):
    summary = get_garden_sensor_summary(hours=48, db=db_session, garden=garden)

    assert summary["garden_id"] == garden.id
    assert len(summary["sensors"]) == 1
    assert summary["soil_moisture_series"][0]["value"] == 28.0