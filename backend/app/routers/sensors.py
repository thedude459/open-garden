from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..database import get_db
from ..core.dependencies import get_owned_garden, get_owned_sensor
from ..models import Bed, Garden, Sensor, SensorReading, User
from ..schemas import (
    GardenSensorSummaryOut,
    SensorDataBatchCreate,
    SensorDataBatchOut,
    SensorDataCreate,
    SensorDataOut,
    SensorOut,
    SensorRegister,
)
from ..sensors import build_sensor_summary

router = APIRouter(tags=["sensors"])


@router.post("/sensors/register", response_model=SensorOut)
def register_sensor(
    payload: SensorRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    garden = (
        db.query(Garden)
        .filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    if payload.bed_id is not None:
        bed = (
            db.query(Bed)
            .filter(Bed.id == payload.bed_id, Bed.garden_id == payload.garden_id)
            .first()
        )
        if bed is None:
            raise HTTPException(status_code=404, detail="Bed not found")

    sensor = Sensor(
        garden_id=payload.garden_id,
        bed_id=payload.bed_id,
        name=payload.name.strip(),
        sensor_kind=payload.sensor_kind,
        unit=payload.unit.strip(),
        location_label=payload.location_label.strip(),
        hardware_id=payload.hardware_id.strip(),
        is_active=True,
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.post("/sensors/{sensor_id}/data", response_model=SensorDataOut)
def ingest_sensor_data(
    payload: SensorDataCreate,
    db: Session = Depends(get_db),
    sensor: Sensor = Depends(get_owned_sensor),
):
    captured_at = payload.captured_at or datetime.now(timezone.utc)
    if captured_at.tzinfo is None:
        captured_at = captured_at.replace(tzinfo=timezone.utc)

    reading = SensorReading(
        sensor_id=sensor.id,
        value=payload.value,
        captured_at=captured_at,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.post("/sensors/{sensor_id}/data/batch", response_model=SensorDataBatchOut)
def ingest_sensor_data_batch(
    payload: SensorDataBatchCreate,
    db: Session = Depends(get_db),
    sensor: Sensor = Depends(get_owned_sensor),
):
    if len(payload.readings) > 500:
        raise HTTPException(status_code=422, detail="Batch limited to 500 readings at a time.")

    readings = []
    for item in payload.readings:
        captured_at = item.captured_at or datetime.now(timezone.utc)
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)
        readings.append(
            SensorReading(sensor_id=sensor.id, value=item.value, captured_at=captured_at)
        )

    db.add_all(readings)
    db.commit()
    return {"inserted": len(readings)}


@router.get("/gardens/{garden_id}/sensors/summary", response_model=GardenSensorSummaryOut)
def get_garden_sensor_summary(
    hours: int = Query(default=48, ge=1, le=336),
    db: Session = Depends(get_db),
    garden: Garden = Depends(get_owned_garden),
):
    sensors = (
        db.query(Sensor).filter(Sensor.garden_id == garden.id, Sensor.is_active.is_(True)).all()
    )
    sensor_ids = [sensor.id for sensor in sensors]
    readings = []
    if sensor_ids:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        readings = (
            db.query(SensorReading)
            .filter(
                SensorReading.sensor_id.in_(sensor_ids),
                SensorReading.captured_at >= cutoff,
            )
            .all()
        )

    return build_sensor_summary(
        garden_id=garden.id, sensors=sensors, readings=readings, horizon_hours=hours
    )
