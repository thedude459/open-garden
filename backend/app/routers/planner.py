import math
from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..database import get_db
from ..core.dependencies import (
    get_owned_bed,
    get_owned_garden,
    get_owned_placement,
    get_owned_planting,
)
from ..models import Bed, CropTemplate, Garden, Placement, Planting, Sensor, Task, User
from ..planning_engine import build_planting_recommendations
from ..schemas import (
    BedCreate,
    BedOut,
    BedPositionUpdate,
    PlacementCreate,
    PlacementMove,
    PlacementOut,
    PlantingCreate,
    PlantingHarvestUpdate,
    PlantingOut,
    PlantingRecommendationsOut,
)
from ..weather import fetch_weather

router = APIRouter(tags=["planner"])


def _crop_task_title(crop_name: str, action: str, variety: str = "") -> str:
    clean_variety = variety.strip()
    base_name = crop_name.strip()
    if clean_variety and base_name.endswith(f" ({clean_variety})"):
        base_name = base_name[: -(len(clean_variety) + 3)].strip()
    if clean_variety:
        return f"{base_name} • {clean_variety}: {action}"
    return f"{base_name}: {action}"


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

    placement_query = db.query(Placement).filter(
        Placement.garden_id == garden.id, Placement.bed_id == bed.id
    )
    if ignore_id is not None:
        placement_query = placement_query.filter(Placement.id != ignore_id)

    existing_placements = placement_query.all()
    if not existing_placements:
        return

    needed_names = {p.crop_name for p in existing_placements} | {crop_name}
    spacing_map: dict[str, int] = {
        row.name: max(1, row.spacing_in)
        for row in db.query(CropTemplate.name, CropTemplate.spacing_in)
        .filter(CropTemplate.name.in_(needed_names))
        .all()
    }
    candidate_spacing = spacing_map.get(crop_name, 12)

    for existing in existing_placements:
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
    placements = db.query(Placement).filter(Placement.bed_id == bed.id).all()
    for placement in placements:
        if (
            placement.grid_x < 0
            or placement.grid_y < 0
            or placement.grid_x >= original_cols
            or placement.grid_y >= original_rows
        ):
            raise HTTPException(
                status_code=409,
                detail="Bed cannot rotate because one or more placements are outside the current bed bounds.",
            )

    for placement in placements:
        old_x = placement.grid_x
        old_y = placement.grid_y
        placement.grid_x = original_rows - 1 - old_y
        placement.grid_y = old_x
        db.add(placement)

    bed.width_in = rotated_width_in
    bed.height_in = rotated_height_in
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.delete("/beds/{bed_id}")
def delete_bed(db: Session = Depends(get_db), bed: Bed = Depends(get_owned_bed)):
    db.query(Placement).filter(Placement.bed_id == bed.id).delete()
    db.query(Planting).filter(Planting.bed_id == bed.id).delete()
    db.query(Sensor).filter(Sensor.bed_id == bed.id).update(
        {Sensor.bed_id: None}, synchronize_session=False
    )
    db.delete(bed)
    db.commit()
    return {"status": "deleted"}


@router.post("/placements", response_model=PlacementOut)
def create_placement(
    payload: PlacementCreate,
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
        db.query(Placement)
        .filter(
            Placement.garden_id == payload.garden_id,
            Placement.bed_id == payload.bed_id,
            Placement.grid_x == payload.grid_x,
            Placement.grid_y == payload.grid_y,
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

    placement = Placement(**payload.model_dump())
    db.add(placement)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cell is already occupied") from exc
    db.refresh(placement)
    return placement


@router.get("/placements", response_model=list[PlacementOut])
def list_placements(
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

    query = db.query(Placement).filter(Placement.garden_id == garden_id)
    if bed_id is not None:
        query = query.filter(Placement.bed_id == bed_id)
    return query.order_by(
        Placement.bed_id.asc(), Placement.grid_y.asc(), Placement.grid_x.asc()
    ).all()


@router.patch("/placements/{placement_id}/move", response_model=PlacementOut)
def move_placement(
    payload: PlacementMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    placement: Placement = Depends(get_owned_placement),
):
    garden = (
        db.query(Garden)
        .filter(Garden.id == placement.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    target_bed = (
        db.query(Bed).filter(Bed.id == payload.bed_id, Bed.garden_id == placement.garden_id).first()
    )
    if target_bed is None:
        raise HTTPException(status_code=404, detail="Target bed not found")

    conflict = (
        db.query(Placement)
        .filter(
            Placement.garden_id == placement.garden_id,
            Placement.bed_id == payload.bed_id,
            Placement.grid_x == payload.grid_x,
            Placement.grid_y == payload.grid_y,
            Placement.id != placement.id,
        )
        .first()
    )
    if conflict is not None:
        raise HTTPException(status_code=409, detail="Target cell is already occupied")

    _validate_spacing(
        db,
        garden=garden,
        bed=target_bed,
        crop_name=placement.crop_name,
        grid_x=payload.grid_x,
        grid_y=payload.grid_y,
        ignore_id=placement.id,
    )

    placement.bed_id = payload.bed_id
    placement.grid_x = payload.grid_x
    placement.grid_y = payload.grid_y
    db.add(placement)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Target cell is already occupied") from exc
    db.refresh(placement)
    return placement


@router.delete("/placements/{placement_id}")
def delete_placement(
    db: Session = Depends(get_db), placement: Placement = Depends(get_owned_placement)
):
    db.delete(placement)
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

    template = db.query(CropTemplate).filter(CropTemplate.name == payload.crop_name).first()
    days_to_harvest = template.days_to_harvest if template else 60
    direct_sow = template.direct_sow if template else True
    weeks_to_transplant = max(1, template.weeks_to_transplant if template else 6)
    crop_notes = template.notes if template else ""
    crop_variety = template.variety if template else ""
    expected_harvest = payload.planted_on + timedelta(days=days_to_harvest)

    planting = Planting(
        garden_id=payload.garden_id,
        bed_id=payload.bed_id,
        crop_name=payload.crop_name,
        planted_on=payload.planted_on,
        expected_harvest_on=expected_harvest,
        source=payload.source,
    )
    db.add(planting)
    db.commit()
    db.refresh(planting)

    zone = garden.growing_zone or "Unknown"
    zone_note = f" (Zone {zone})" if zone and zone != "Unknown" else ""
    crop = payload.crop_name
    t0 = payload.planted_on

    auto_tasks: list[tuple[str, object, str]] = []

    if not direct_sow:
        start_date = t0 - timedelta(days=weeks_to_transplant * 7)
        auto_tasks.append(
            (
                _crop_task_title(crop, "Start seeds indoors", crop_variety),
                start_date,
                f"Fill trays with seed-starting mix. Sow 2 seeds per cell at 70–75 F{zone_note}. Thin to strongest seedling once germinated.",
            )
        )
        harden_date = t0 - timedelta(days=7)
        if harden_date > start_date:
            auto_tasks.append(
                (
                    _crop_task_title(crop, "Harden off seedlings", crop_variety),
                    harden_date,
                    f"Move seedlings outside in a sheltered spot for 2-3 hrs/day{zone_note}. Increase exposure over 7 days to avoid transplant shock.",
                )
            )
        auto_tasks.append(
            (
                _crop_task_title(crop, "Transplant seedlings to bed", crop_variety),
                t0,
                f"Plant at soil level. Water in with dilute liquid fertiliser{zone_note}. Protect with row cover if frost is still possible.",
            )
        )
    else:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Direct sow seeds", crop_variety),
                t0,
                f"Sow seeds at the depth and spacing shown on the packet{zone_note}. Keep soil moist (not saturated) until emergence.",
            )
        )

    auto_tasks.append(
        (
            _crop_task_title(crop, "Water and check establishment", crop_variety),
            t0 + timedelta(days=3),
            "Check soil 1 inch deep - water when dry. Consistent moisture is critical in the first two weeks.",
        )
    )
    if days_to_harvest > 10:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Water and thin seedlings", crop_variety),
                t0 + timedelta(days=10),
                "Thin direct-sown seedlings if crowded. Water at the base; avoid wetting foliage.",
            )
        )

    if days_to_harvest > 14:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Weed bed", crop_variety),
                t0 + timedelta(days=14),
                "Remove weeds before they compete for nutrients. Shallow hoe to avoid disturbing roots.",
            )
        )
        auto_tasks.append(
            (
                _crop_task_title(crop, "Pest and disease check", crop_variety),
                t0 + timedelta(days=7),
                f"Inspect leaves top and underside for pests, discolouration or disease{zone_note}. Treat organically early - neem oil or insecticidal soap for soft-bodied insects.",
            )
        )

    if days_to_harvest > 20:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Fertilise", crop_variety),
                t0 + timedelta(days=20),
                "Apply balanced fertiliser (e.g. 10-10-10) or side-dress with compost. Avoid excess nitrogen once flowering begins.",
            )
        )

    if days_to_harvest > 40:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Mid-season weed and water check", crop_variety),
                t0 + timedelta(days=40),
                "Remove weeds; check mulch depth (2-3 in helps retain moisture and suppress weeds). Deep watering every few days is better than shallow daily watering.",
            )
        )
    if days_to_harvest > 45:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Mid-season pest inspection", crop_variety),
                t0 + timedelta(days=45),
                "Check for disease progression; remove and dispose of infected leaves. Apply a second round of fertiliser if growth looks slow.",
            )
        )

    if days_to_harvest > 70:
        auto_tasks.append(
            (
                _crop_task_title(crop, "Late-season check", crop_variety),
                t0 + timedelta(days=70),
                f"Ensure adequate water as fruit/roots swell{zone_note}. Watch for late blight (wet weather). Begin preparing bed for next crop rotation.",
            )
        )

    harvest_note = f"Expected ~day {days_to_harvest}{zone_note}."
    if crop_notes:
        harvest_note += f" {crop_notes}"
    auto_tasks.append(
        (
            _crop_task_title(crop, "Harvest window opens", crop_variety),
            t0 + timedelta(days=days_to_harvest),
            harvest_note,
        )
    )

    for title, due_on, notes in auto_tasks:
        db.add(
            Task(
                garden_id=payload.garden_id,
                planting_id=planting.id,
                title=title,
                due_on=due_on,
                notes=notes,
            )
        )
    db.commit()

    return planting


@router.get("/plantings", response_model=list[PlantingOut])
def list_plantings(
    garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    garden = (
        db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return db.query(Planting).filter(Planting.garden_id == garden_id).all()


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
