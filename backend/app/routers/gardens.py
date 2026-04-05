from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..engines.climate import build_climate_summary, build_dynamic_planting_windows
from ..database import get_db
from ..core.dependencies import get_owned_garden
from ..core.exceptions import ValidationServiceError
from ..engines.layout import build_garden_sun_path
from ..models import (
    CropTemplate,
    Garden,
    PestLog,
    Placement,
    Planting,
    Sensor,
    SensorReading,
    Task,
    User,
)
from ..schemas import (
    GardenClimateOut,
    GardenClimatePlantingWindowsOut,
    GardenCreate,
    GardenMicroclimateUpdate,
    GardenOut,
    GardenSunPathOut,
    GardenYardUpdate,
    MicroclimateSuggestionOut,
)
from ..weather import (
    fetch_address_geocode,
    fetch_microclimate_signals,
    fetch_weather,
    fetch_zip_profile,
)

router = APIRouter(tags=["gardens"])


@router.post("/gardens", response_model=GardenOut)
async def create_garden(
    payload: GardenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        location = await fetch_zip_profile(payload.zip_code)
    except ValidationServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    garden = Garden(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        zip_code=location["zip_code"],
        growing_zone=location["growing_zone"],
        yard_width_ft=max(4, payload.yard_width_ft),
        yard_length_ft=max(4, payload.yard_length_ft),
        latitude=location["latitude"],
        longitude=location["longitude"],
        orientation=payload.orientation,
        sun_exposure=payload.sun_exposure,
        wind_exposure=payload.wind_exposure,
        thermal_mass=payload.thermal_mass,
        slope_position=payload.slope_position,
        frost_pocket_risk=payload.frost_pocket_risk,
        address_private=payload.address_private,
        is_shared=payload.is_shared,
    )
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@router.get("/gardens", response_model=list[GardenOut])
def list_my_gardens(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Garden).filter(Garden.owner_id == current_user.id).all()


@router.get("/gardens/public", response_model=list[GardenOut])
def list_public_gardens(db: Session = Depends(get_db)):
    gardens = db.query(Garden).filter(Garden.is_shared.is_(True)).all()
    result = []
    for g in gardens:
        out = GardenOut.model_validate(g)
        out.address_private = ""
        result.append(out)
    return result


@router.patch("/gardens/{garden_id}/geocode", response_model=GardenOut)
async def geocode_garden_address(
    garden: Garden = Depends(get_owned_garden), db: Session = Depends(get_db)
):
    if not garden.address_private:
        raise HTTPException(
            status_code=400,
            detail="No private address stored for this garden. Add one in the Climate & Site Profile and save first.",
        )

    try:
        result = await fetch_address_geocode(garden.address_private)
    except ValidationServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    garden.latitude = result["latitude"]
    garden.longitude = result["longitude"]
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@router.patch("/gardens/{garden_id}/yard", response_model=GardenOut)
def update_garden_yard(
    payload: GardenYardUpdate,
    db: Session = Depends(get_db),
    garden: Garden = Depends(get_owned_garden),
):
    garden.yard_width_ft = max(4, payload.yard_width_ft)
    garden.yard_length_ft = max(4, payload.yard_length_ft)
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@router.patch("/gardens/{garden_id}/microclimate", response_model=GardenOut)
def update_garden_microclimate(
    payload: GardenMicroclimateUpdate,
    db: Session = Depends(get_db),
    garden: Garden = Depends(get_owned_garden),
):
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(garden, field, value)

    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@router.get("/gardens/{garden_id}/microclimate/suggest", response_model=MicroclimateSuggestionOut)
async def suggest_garden_microclimate(garden: Garden = Depends(get_owned_garden)):
    try:
        result = await fetch_microclimate_signals(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Unable to fetch location signals for suggestions."
        ) from exc

    suggestions = result["suggestions"]
    notes = result["notes"]

    def _signal(key: str) -> dict:
        return {"value": suggestions.get(key), "note": notes.get(key, "")}

    return MicroclimateSuggestionOut(
        sun_exposure=_signal("sun_exposure"),
        wind_exposure=_signal("wind_exposure"),
        slope_position=_signal("slope_position"),
        frost_pocket_risk=_signal("frost_pocket_risk"),
        orientation={"value": None, "note": notes["orientation"]},
        thermal_mass={"value": None, "note": notes["thermal_mass"]},
    )


@router.get("/gardens/{garden_id}/climate", response_model=GardenClimateOut)
async def get_garden_climate(garden: Garden = Depends(get_owned_garden)):
    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Unable to fetch forecast for climate analysis."
        ) from exc

    return build_climate_summary(garden, weather)


@router.get(
    "/gardens/{garden_id}/climate/planting-windows", response_model=GardenClimatePlantingWindowsOut
)
async def get_garden_climate_planting_windows(
    db: Session = Depends(get_db),
    garden: Garden = Depends(get_owned_garden),
):
    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Unable to fetch forecast for planting windows."
        ) from exc

    crop_templates = (
        db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()
    )
    return build_dynamic_planting_windows(garden, weather, crop_templates)


@router.get("/gardens/{garden_id}/layout/sun-path", response_model=GardenSunPathOut)
def get_garden_layout_sun_path(
    on_date: date | None = Query(default=None),
    garden: Garden = Depends(get_owned_garden),
):
    target_date = on_date or date.today()
    return build_garden_sun_path(garden, target_date)


@router.delete("/gardens/{garden_id}")
def delete_garden(db: Session = Depends(get_db), garden: Garden = Depends(get_owned_garden)):
    db.query(PestLog).filter(PestLog.garden_id == garden.id).delete()
    db.query(Task).filter(Task.garden_id == garden.id).delete()
    db.query(Planting).filter(Planting.garden_id == garden.id).delete()
    db.query(Placement).filter(Placement.garden_id == garden.id).delete()
    sensor_ids = [row.id for row in db.query(Sensor.id).filter(Sensor.garden_id == garden.id).all()]
    if sensor_ids:
        db.query(SensorReading).filter(SensorReading.sensor_id.in_(sensor_ids)).delete(
            synchronize_session=False
        )
    db.query(Sensor).filter(Sensor.garden_id == garden.id).delete()
    # beds FK-cascade is handled by ORM relationship cascade
    db.delete(garden)
    db.commit()
    return {"status": "deleted"}
