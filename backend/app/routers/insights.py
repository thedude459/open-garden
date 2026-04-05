"""AI coach, timeline, and seasonal plan endpoints."""

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..ai_coach import build_coach_context, generate_coach_response
from ..core.auth import get_current_user
from ..engines.climate import build_dynamic_planting_windows
from ..database import get_db
from ..models import CropTemplate, Garden, Planting, Sensor, SensorReading, Task
from ..planning_engine import build_seasonal_plan
from ..schemas import AiCoachRequest, AiCoachResponseOut, GardenSeasonalPlanOut, GardenTimelineOut
from ..sensors import build_sensor_summary
from ..engines.timeline import build_unified_timeline
from ..weather import fetch_weather

router = APIRouter()


@router.post("/ai/coach", response_model=AiCoachResponseOut)
async def ai_coach(
    payload: AiCoachRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    garden = (
        db.query(Garden)
        .filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        weather = None

    plantings = db.query(Planting).filter(Planting.garden_id == garden.id).all()
    tasks = db.query(Task).filter(Task.garden_id == garden.id).all()

    sensors = (
        db.query(Sensor).filter(Sensor.garden_id == garden.id, Sensor.is_active.is_(True)).all()
    )
    sensor_ids = [sensor.id for sensor in sensors]
    readings = []
    if sensor_ids:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
        readings = (
            db.query(SensorReading)
            .filter(
                SensorReading.sensor_id.in_(sensor_ids),
                SensorReading.captured_at >= cutoff,
            )
            .all()
        )
    sensor_summary = build_sensor_summary(
        garden_id=garden.id, sensors=sensors, readings=readings, horizon_hours=72
    )

    context = build_coach_context(
        garden=garden,
        weather=weather,
        plantings=plantings,
        tasks=tasks,
        sensor_summary=sensor_summary,
        user_message=payload.message,
        scenario=(payload.scenario.model_dump() if payload.scenario else {}),
    )
    return generate_coach_response(context)


@router.get("/gardens/{garden_id}/timeline", response_model=GardenTimelineOut)
async def get_garden_timeline(
    garden_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    garden = (
        db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    weather = None
    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        weather = None

    tasks = db.query(Task).filter(Task.garden_id == garden.id).all()
    plantings = db.query(Planting).filter(Planting.garden_id == garden.id).all()
    crop_templates = (
        db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()
    )

    planting_windows = (
        build_dynamic_planting_windows(garden, weather or {}, crop_templates)
        if weather
        else {"windows": []}
    )

    sensors = (
        db.query(Sensor).filter(Sensor.garden_id == garden.id, Sensor.is_active.is_(True)).all()
    )
    sensor_ids = [sensor.id for sensor in sensors]
    readings = []
    if sensor_ids:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
        readings = (
            db.query(SensorReading)
            .filter(
                SensorReading.sensor_id.in_(sensor_ids),
                SensorReading.captured_at >= cutoff,
            )
            .all()
        )
    sensor_summary = build_sensor_summary(
        garden_id=garden.id, sensors=sensors, readings=readings, horizon_hours=72
    )

    coach_context = build_coach_context(
        garden=garden,
        weather=weather,
        plantings=plantings,
        tasks=tasks,
        sensor_summary=sensor_summary,
        user_message="Generate timeline recommendations.",
        scenario={},
    )
    coach_response = generate_coach_response(coach_context)

    return build_unified_timeline(
        tasks=tasks,
        weather=weather,
        planting_windows=planting_windows,
        sensor_summary=sensor_summary,
        coach_response=coach_response,
    )


@router.get("/gardens/{garden_id}/plan/seasonal", response_model=GardenSeasonalPlanOut)
async def get_garden_seasonal_plan(
    garden_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    garden = (
        db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Unable to fetch forecast for seasonal planning."
        ) from exc

    crop_templates = (
        db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()
    )
    plantings = db.query(Planting).filter(Planting.garden_id == garden_id).all()
    return build_seasonal_plan(garden, weather, crop_templates, plantings)
