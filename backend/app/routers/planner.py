import math
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..database import get_db
from ..core.dependencies import (
    get_owned_bed,
    get_owned_garden,
    get_owned_planting,
)
from ..models import Bed, CropTemplate, Garden, Planting, Sensor, User
from ..planning_engine import build_planting_recommendations
from ..services.planting_tasks import (
    delete_garden_schedule_tasks,
    indoor_effective_bed_entry_date,
    rebuild_garden_autotasks,
    replace_planting_autotasks,
)
from ..schemas import (
    BedCreate,
    BedOut,
    BedPositionUpdate,
    BedRenameUpdate,
    PlantingCreate,
    PlantingDatesUpdate,
    PlantingHarvestUpdate,
    PlantingMove,
    PlantingOut,
    PlantingRecommendationsOut,
    PlantingRelocate,
)
from ..weather import fetch_weather

router = APIRouter(tags=["planner"])


def _validate_spacing(
    db: Session,
    *,
    garden: Garden,
    bed: Bed,
    crop_name: str,
    grid_x: int,
    grid_y: int,
    ignore_id: int | None = None,
) -> None:
    buffer_cells = max(0, (garden.edge_buffer_in + 2) // 3)
    bed_cols = max(1, bed.width_in // 3)
    bed_rows = max(1, bed.height_in // 3)

    if (
        grid_x < buffer_cells
        or grid_x >= bed_cols - buffer_cells
        or grid_y < buffer_cells
        or grid_y >= bed_rows - buffer_cells
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Placement is too close to the bed edge. Required buffer is {garden.edge_buffer_in} inches.",
        )

    planting_query = db.query(Planting).filter(
        Planting.garden_id == garden.id, Planting.bed_id == bed.id
    )
    if ignore_id is not None:
        planting_query = planting_query.filter(Planting.id != ignore_id)

    existing_plantings = planting_query.all()
    if not existing_plantings:
        return

    needed_names = {p.crop_name for p in existing_plantings} | {crop_name}
    spacing_map: dict[str, int] = {
        row.name: max(1, row.spacing_in)
        for row in db.query(CropTemplate.name, CropTemplate.spacing_in)
        .filter(CropTemplate.name.in_(needed_names))
        .all()
    }
    candidate_spacing = spacing_map.get(crop_name, 12)

    for existing in existing_plantings:
        existing_spacing = spacing_map.get(existing.crop_name, 12)
        required_clearance = max(candidate_spacing, existing_spacing)
        distance_in = math.sqrt(
            ((grid_x - existing.grid_x) * 12) ** 2 + ((grid_y - existing.grid_y) * 12) ** 2
        )
        if distance_in < required_clearance:
            raise HTTPException(
                status_code=409,
                detail=f"Too close to {existing.crop_name}. Required spacing is {required_clearance} inches.",
            )


@router.post("/gardens/{garden_id}/beds", response_model=BedOut)
def create_bed(
    payload: BedCreate, db: Session = Depends(get_db), garden: Garden = Depends(get_owned_garden)
):
    bed = Bed(garden_id=garden.id, **payload.model_dump())
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.get("/gardens/{garden_id}/beds", response_model=list[BedOut])
def list_beds(db: Session = Depends(get_db), garden: Garden = Depends(get_owned_garden)):
    return db.query(Bed).filter(Bed.garden_id == garden.id).all()


@router.patch("/beds/{bed_id}/position", response_model=BedOut)
def update_bed_position(
    payload: BedPositionUpdate, db: Session = Depends(get_db), bed: Bed = Depends(get_owned_bed)
):
    garden = db.query(Garden).filter(Garden.id == bed.garden_id).first()

    bed_width_ft = max(1, math.ceil(bed.width_in / 12))
    bed_length_ft = max(1, math.ceil(bed.height_in / 12))
    max_x = max(0, garden.yard_width_ft - bed_width_ft)
    max_y = max(0, garden.yard_length_ft - bed_length_ft)

    bed.grid_x = min(max(0, payload.grid_x), max_x)
    bed.grid_y = min(max(0, payload.grid_y), max_y)
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.patch("/beds/{bed_id}", response_model=BedOut)
def rename_bed(
    payload: BedRenameUpdate, db: Session = Depends(get_db), bed: Bed = Depends(get_owned_bed)
):
    next_name = payload.name.strip()
    if not next_name:
        raise HTTPException(status_code=422, detail="Bed name cannot be empty")
    bed.name = next_name
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.patch("/beds/{bed_id}/rotate", response_model=BedOut)
def rotate_bed_in_yard(db: Session = Depends(get_db), bed: Bed = Depends(get_owned_bed)):
    garden = db.query(Garden).filter(Garden.id == bed.garden_id).first()

    rotated_width_in = bed.height_in
    rotated_height_in = bed.width_in
    rotated_width_ft = max(1, math.ceil(rotated_width_in / 12))
    rotated_height_ft = max(1, math.ceil(rotated_height_in / 12))

    if (
        bed.grid_x + rotated_width_ft > garden.yard_width_ft
        or bed.grid_y + rotated_height_ft > garden.yard_length_ft
    ):
        raise HTTPException(
            status_code=409,
            detail="Bed cannot rotate at its current yard position. Move it away from the yard edge first.",
        )

    other_beds = db.query(Bed).filter(Bed.garden_id == garden.id, Bed.id != bed.id).all()
    rotated_left = bed.grid_x
    rotated_top = bed.grid_y
    rotated_right = rotated_left + rotated_width_ft
    rotated_bottom = rotated_top + rotated_height_ft
    for other in other_beds:
        other_width_ft = max(1, math.ceil(other.width_in / 12))
        other_height_ft = max(1, math.ceil(other.height_in / 12))
        other_left = other.grid_x
        other_top = other.grid_y
        other_right = other_left + other_width_ft
        other_bottom = other_top + other_height_ft
        intersects = (
            rotated_left < other_right
            and rotated_right > other_left
            and rotated_top < other_bottom
            and rotated_bottom > other_top
        )
        if intersects:
            raise HTTPException(
                status_code=409,
                detail="Bed cannot rotate because it would overlap another bed in the yard.",
            )

    original_cols = max(1, math.ceil(bed.width_in / 3))
    original_rows = max(1, math.ceil(bed.height_in / 3))
    plantings = db.query(Planting).filter(Planting.bed_id == bed.id).all()
    for planting in plantings:
        if (
            planting.grid_x < 0
            or planting.grid_y < 0
            or planting.grid_x >= original_cols
            or planting.grid_y >= original_rows
        ):
            raise HTTPException(
                status_code=409,
                detail="Bed cannot rotate because one or more plantings are outside the current bed bounds.",
            )

    for planting in plantings:
        old_x = planting.grid_x
        old_y = planting.grid_y
        planting.grid_x = original_rows - 1 - old_y
        planting.grid_y = old_x
        db.add(planting)

    bed.width_in = rotated_width_in
    bed.height_in = rotated_height_in
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.delete("/beds/{bed_id}")
def delete_bed(db: Session = Depends(get_db), bed: Bed = Depends(get_owned_bed)):
    garden_id = bed.garden_id
    delete_garden_schedule_tasks(db, garden_id)
    db.query(Planting).filter(Planting.bed_id == bed.id).delete(synchronize_session=False)
    db.query(Sensor).filter(Sensor.bed_id == bed.id).update(
        {Sensor.bed_id: None}, synchronize_session=False
    )
    db.delete(bed)
    db.commit()
    garden = db.query(Garden).filter(Garden.id == garden_id).first()
    if garden is not None:
        rebuild_garden_autotasks(db, garden=garden)
        db.commit()
    return {"status": "deleted"}


@router.post("/plantings", response_model=PlantingOut)
def create_planting(
    payload: PlantingCreate,
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

    bed = db.query(Bed).filter(Bed.id == payload.bed_id, Bed.garden_id == payload.garden_id).first()
    if bed is None:
        raise HTTPException(status_code=404, detail="Bed not found")

    existing = (
        db.query(Planting)
        .filter(
            Planting.garden_id == payload.garden_id,
            Planting.bed_id == payload.bed_id,
            Planting.grid_x == payload.grid_x,
            Planting.grid_y == payload.grid_y,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Cell is already occupied")

    _validate_spacing(
        db,
        garden=garden,
        bed=bed,
        crop_name=payload.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
    )

    template = db.query(CropTemplate).filter(CropTemplate.name == payload.crop_name).first()
    days_to_harvest = template.days_to_harvest if template else 60
    weeks_to_transplant = max(1, template.weeks_to_transplant if template else 6)

    # `planted_on` semantics:
    #   - location=in_bed: the date the plant entered the bed (sow or transplant date).
    #   - location=indoor: the date the seed was started indoors. The bed-side
    #     timeline (harden-off, transplant, watering, harvest) is anchored on
    #     the planned bed-entry date — either an explicit `moved_on` supplied
    #     by the user (winter planning workflow), or `planted_on +
    #     weeks_to_transplant` as a default.
    if payload.location == "indoor":
        bed_entry_date = indoor_effective_bed_entry_date(
            payload.planted_on, payload.moved_on, weeks_to_transplant
        )
        # Only persist moved_on when the user explicitly set one. When set, store
        # the effective bed-entry date (may be later than the draft date if it
        # was earlier than planted_on + weeks_to_transplant).
        planned_moved_on = bed_entry_date if payload.moved_on is not None else None
    else:
        bed_entry_date = payload.planted_on
        planned_moved_on = None
    expected_harvest = bed_entry_date + timedelta(days=days_to_harvest)

    planting = Planting(
        garden_id=payload.garden_id,
        bed_id=payload.bed_id,
        crop_name=payload.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
        color=payload.color,
        planted_on=payload.planted_on,
        expected_harvest_on=expected_harvest,
        method=payload.method,
        location=payload.location,
        moved_on=planned_moved_on,
        source=payload.source,
    )
    db.add(planting)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cell is already occupied") from exc
    db.refresh(planting)

    rebuild_garden_autotasks(db, garden=garden)
    db.commit()

    return planting


@router.get("/plantings", response_model=list[PlantingOut])
def list_plantings(
    garden_id: int,
    bed_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    garden = (
        db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    query = db.query(Planting).filter(Planting.garden_id == garden_id)
    if bed_id is not None:
        query = query.filter(Planting.bed_id == bed_id)
    return query.order_by(Planting.bed_id.asc(), Planting.grid_y.asc(), Planting.grid_x.asc()).all()


@router.patch("/plantings/{planting_id}/move", response_model=PlantingOut)
def move_planting(
    payload: PlantingMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    planting: Planting = Depends(get_owned_planting),
):
    garden = (
        db.query(Garden)
        .filter(Garden.id == planting.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    target_bed = (
        db.query(Bed).filter(Bed.id == payload.bed_id, Bed.garden_id == planting.garden_id).first()
    )
    if target_bed is None:
        raise HTTPException(status_code=404, detail="Target bed not found")

    conflict = (
        db.query(Planting)
        .filter(
            Planting.garden_id == planting.garden_id,
            Planting.bed_id == payload.bed_id,
            Planting.grid_x == payload.grid_x,
            Planting.grid_y == payload.grid_y,
            Planting.id != planting.id,
        )
        .first()
    )
    if conflict is not None:
        raise HTTPException(status_code=409, detail="Target cell is already occupied")

    _validate_spacing(
        db,
        garden=garden,
        bed=target_bed,
        crop_name=planting.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
        ignore_id=planting.id,
    )

    planting.bed_id = payload.bed_id
    planting.grid_x = payload.grid_x
    planting.grid_y = payload.grid_y
    db.add(planting)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Target cell is already occupied") from exc
    db.refresh(planting)
    return planting


@router.patch("/plantings/{planting_id}/relocate", response_model=PlantingOut)
def relocate_planting(
    payload: PlantingRelocate,
    db: Session = Depends(get_db),
    planting: Planting = Depends(get_owned_planting),
):
    moved_into_bed = payload.location == "in_bed" and planting.location != "in_bed"
    planting.location = payload.location
    if payload.location == "in_bed":
        planting.moved_on = payload.moved_on or date.today()
    else:
        planting.moved_on = payload.moved_on
    db.add(planting)

    if moved_into_bed:
        template = db.query(CropTemplate).filter(CropTemplate.name == planting.crop_name).first()
        days_to_harvest = template.days_to_harvest if template else 60
        entry = planting.moved_on or date.today()
        planting.expected_harvest_on = entry + timedelta(days=days_to_harvest)
        db.add(planting)

        garden = db.query(Garden).filter(Garden.id == planting.garden_id).first()
        if garden is not None:
            replace_planting_autotasks(
                db, garden=garden, planting=planting, mark_transplant_done=True
            )

    db.commit()
    db.refresh(planting)
    return planting


@router.patch("/plantings/{planting_id}/dates", response_model=PlantingOut)
def update_planting_dates(
    payload: PlantingDatesUpdate,
    db: Session = Depends(get_db),
    planting: Planting = Depends(get_owned_planting),
):
    """Adjust the seed-start and/or planned bed-entry dates of a planting.

    Used during winter planning when the user is sketching out the season —
    they can shift dates forward or back without re-creating the planting.
    The expected harvest date is recomputed and auto-generated planting tasks
    are rescheduled to match the new bed-entry timeline.
    """

    if payload.planted_on is not None:
        planting.planted_on = payload.planted_on

    if payload.moved_on is not None:
        planting.moved_on = payload.moved_on
    elif payload.clear_moved_on:
        planting.moved_on = None

    template = db.query(CropTemplate).filter(CropTemplate.name == planting.crop_name).first()
    days_to_harvest = template.days_to_harvest if template else 60
    weeks_to_transplant = max(1, template.weeks_to_transplant if template else 6)

    if planting.location == "indoor":
        bed_entry_date = indoor_effective_bed_entry_date(
            planting.planted_on, planting.moved_on, weeks_to_transplant
        )
        if planting.moved_on is not None:
            planting.moved_on = bed_entry_date
    else:
        if planting.moved_on is not None:
            bed_entry_date = planting.moved_on
        else:
            bed_entry_date = planting.planted_on
    planting.expected_harvest_on = bed_entry_date + timedelta(days=days_to_harvest)

    db.add(planting)
    db.commit()
    db.refresh(planting)

    garden = db.query(Garden).filter(Garden.id == planting.garden_id).first()
    if garden is not None:
        replace_planting_autotasks(db, garden=garden, planting=planting)
        db.commit()
        db.refresh(planting)

    return planting


@router.delete("/plantings/{planting_id}")
def delete_planting(
    db: Session = Depends(get_db), planting: Planting = Depends(get_owned_planting)
):
    """Remove a planting and its schedule tasks.

    Schedule-backed tasks must be cleared *before* deleting the row: they
    reference ``plantings.id`` (including bundled rows whose ``planting_id``
    is the canonical placement).
    """
    garden_id = planting.garden_id
    delete_garden_schedule_tasks(db, garden_id)
    db.delete(planting)
    db.commit()
    garden = db.query(Garden).filter(Garden.id == garden_id).first()
    if garden is not None:
        rebuild_garden_autotasks(db, garden=garden)
        db.commit()
    return {"status": "deleted"}


@router.patch("/plantings/{planting_id}/harvest", response_model=PlantingOut)
def log_harvest(
    payload: PlantingHarvestUpdate,
    db: Session = Depends(get_db),
    planting: Planting = Depends(get_owned_planting),
):
    planting.harvested_on = payload.harvested_on
    planting.yield_notes = payload.yield_notes
    db.commit()
    db.refresh(planting)
    return planting


@router.get("/plantings/{planting_id}/recommendations", response_model=PlantingRecommendationsOut)
async def get_planting_recommendations(
    db: Session = Depends(get_db),
    planting: Planting = Depends(get_owned_planting),
):
    garden = db.query(Garden).filter(Garden.id == planting.garden_id).first()

    try:
        weather = await fetch_weather(garden.latitude, garden.longitude)
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Unable to fetch forecast for planting recommendations."
        ) from exc

    crop_templates = (
        db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()
    )
    plantings = db.query(Planting).filter(Planting.garden_id == garden.id).all()
    return build_planting_recommendations(planting, garden, weather, crop_templates, plantings)
