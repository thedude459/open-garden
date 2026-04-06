"""Crop template CRUD and sync management."""

from threading import Thread

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..database import SessionLocal, get_db
from ..core.logging_utils import get_logger
from ..models import CropTemplate, Placement, Planting, Task
from ..schemas import CropTemplateCreate, CropTemplateSyncStatusOut, CropTemplateOut, MessageOut
from ..services.seed import cleanup_legacy_starter_templates, seed_crop_templates
from ..services import (
    ensure_crop_sync_state,
    get_crop_sync_state_snapshot,
    update_crop_sync_state,
    utc_now,
)

router = APIRouter()
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Name normalisation helpers (also used by planner when renaming crops)
# ---------------------------------------------------------------------------


def crop_name_parts(crop_name: str, variety: str = "") -> tuple[str, str]:
    clean_variety = variety.strip()
    if clean_variety and crop_name.endswith(f" ({clean_variety})"):
        return crop_name[: -(len(clean_variety) + 3)].strip(), clean_variety
    return crop_name.strip(), clean_variety


def normalized_crop_identity(crop_name: str, variety: str = "") -> tuple[str, str]:
    clean_name = crop_name.strip()
    clean_variety = variety.strip()
    if not clean_variety and clean_name.endswith(")") and " (" in clean_name:
        base, suffix = clean_name.rsplit(" (", 1)
        clean_name = base.strip()
        clean_variety = suffix[:-1].strip()
    return clean_name.lower(), clean_variety.lower()


def canonical_crop_template_name(crop_name: str, variety: str = "") -> tuple[str, str]:
    base_name, clean_variety = crop_name_parts(crop_name, variety)
    if clean_variety:
        return f"{base_name} ({clean_variety})", clean_variety
    return base_name, ""


def crop_task_title(crop_name: str, action: str, variety: str = "") -> str:
    base_name, clean_variety = crop_name_parts(crop_name, variety)
    if clean_variety:
        return f"{base_name} • {clean_variety}: {action}"
    return f"{base_name}: {action}"


# ---------------------------------------------------------------------------
# Background sync helpers
# ---------------------------------------------------------------------------


def _run_crop_sync(force_refresh: bool) -> None:
    db = SessionLocal()
    update_crop_sync_state(
        db,
        status="running",
        is_running=True,
        message="Syncing crop catalogs in the background...",
        last_started_at=utc_now(),
        error=None,
        added=0,
        updated=0,
        skipped=0,
        failed=0,
    )

    try:
        result = seed_crop_templates(db, force_refresh=force_refresh)
    except RuntimeError as exc:
        logger.exception("crop sync failed")
        update_crop_sync_state(
            db,
            status="failed",
            is_running=False,
            message="Crop catalog sync failed.",
            last_finished_at=utc_now(),
            error=str(exc),
        )
        db.close()
        return

    update_crop_sync_state(
        db,
        status="succeeded",
        is_running=False,
        message="Crop catalog sync completed successfully.",
        last_finished_at=utc_now(),
        added=result["added"],
        updated=result["updated"],
        skipped=result["skipped"],
        failed=result["failed"],
        error=None,
    )
    db.close()


def start_crop_sync(force_refresh: bool) -> bool:
    db = SessionLocal()
    state = ensure_crop_sync_state(db)
    if state.is_running:
        db.close()
        return False
    update_crop_sync_state(db, is_running=True)
    db.close()
    Thread(target=_run_crop_sync, args=(force_refresh,), daemon=True).start()
    return True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/crop-templates", response_model=list[CropTemplateOut])
def list_crop_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return (
        db.query(CropTemplate).order_by(CropTemplate.name.asc(), CropTemplate.variety.asc()).all()
    )


@router.get("/crop-templates/sync-status", response_model=CropTemplateSyncStatusOut)
def crop_template_sync_status(_=Depends(get_current_user), db: Session = Depends(get_db)):
    return get_crop_sync_state_snapshot(db)


@router.post("/crop-templates/refresh", response_model=MessageOut)
def refresh_crop_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    del db
    started = start_crop_sync(force_refresh=True)
    if not started:
        return {"message": "Crop database sync is already running."}
    return {"message": "Crop database sync started in the background."}


@router.post("/crop-templates/cleanup-legacy", response_model=MessageOut)
def cleanup_legacy_crop_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    state = ensure_crop_sync_state(db)
    if state.is_running:
        raise HTTPException(
            status_code=409,
            detail="Wait for the active crop sync to finish before cleaning up legacy templates.",
        )
    removed = cleanup_legacy_starter_templates(db)
    update_crop_sync_state(db, cleaned_legacy_count=removed)
    return {
        "message": f"Removed {removed} legacy starter crop template{'s' if removed != 1 else ''}."
    }


@router.post("/crop-templates", response_model=CropTemplateOut)
def create_crop_template(
    payload: CropTemplateCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    base_name = payload.name.strip()
    variety = payload.variety.strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="Crop name is required")

    stored_name, stored_variety = canonical_crop_template_name(base_name, variety)

    target_identity = normalized_crop_identity(stored_name, stored_variety)
    name_lower, variety_lower = target_identity
    _candidate_names = [name_lower]
    if variety_lower:
        _candidate_names.append(f"{name_lower} ({variety_lower})")
    existing = next(
        (
            c
            for c in db.query(CropTemplate)
            .filter(func.lower(CropTemplate.name).in_(_candidate_names))
            .all()
            if normalized_crop_identity(c.name, c.variety) == target_identity
        ),
        None,
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Crop already exists")

    crop = CropTemplate(
        name=stored_name,
        variety=stored_variety,
        source="manual",
        source_url="",
        image_url=payload.image_url.strip(),
        external_product_id="",
        family=payload.family.strip(),
        spacing_in=max(1, payload.spacing_in),
        days_to_harvest=max(1, payload.days_to_harvest),
        planting_window=payload.planting_window.strip() or "Spring",
        direct_sow=payload.direct_sow,
        frost_hardy=payload.frost_hardy,
        weeks_to_transplant=max(1, payload.weeks_to_transplant),
        notes=payload.notes.strip(),
    )
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop


@router.patch("/crop-templates/{crop_id}", response_model=CropTemplateOut)
def update_crop_template(
    crop_id: int,
    payload: CropTemplateCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    crop = db.query(CropTemplate).filter(CropTemplate.id == crop_id).first()
    if crop is None:
        raise HTTPException(status_code=404, detail="Crop not found")

    base_name = payload.name.strip()
    variety = payload.variety.strip()
    if not base_name:
        raise HTTPException(status_code=400, detail="Crop name is required")

    stored_name, stored_variety = canonical_crop_template_name(base_name, variety)

    target_identity = normalized_crop_identity(stored_name, stored_variety)
    name_lower, variety_lower = target_identity
    _candidate_names = [name_lower]
    if variety_lower:
        _candidate_names.append(f"{name_lower} ({variety_lower})")
    existing = next(
        (
            c
            for c in db.query(CropTemplate)
            .filter(
                func.lower(CropTemplate.name).in_(_candidate_names),
                CropTemplate.id != crop_id,
            )
            .all()
            if normalized_crop_identity(c.name, c.variety) == target_identity
        ),
        None,
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Crop already exists")

    old_name = crop.name
    old_planting_ids = [
        row.id for row in db.query(Planting.id).filter(Planting.crop_name == old_name).all()
    ]

    crop.name = stored_name
    crop.variety = stored_variety
    crop.family = payload.family.strip()
    crop.image_url = payload.image_url.strip()
    crop.spacing_in = max(1, payload.spacing_in)
    crop.days_to_harvest = max(1, payload.days_to_harvest)
    crop.planting_window = payload.planting_window.strip() or "Spring"
    crop.direct_sow = payload.direct_sow
    crop.frost_hardy = payload.frost_hardy
    crop.weeks_to_transplant = max(1, payload.weeks_to_transplant)
    crop.notes = payload.notes.strip()

    if old_name != stored_name:
        db.query(Placement).filter(Placement.crop_name == old_name).update(
            {Placement.crop_name: stored_name}, synchronize_session=False
        )
        db.query(Planting).filter(Planting.crop_name == old_name).update(
            {Planting.crop_name: stored_name}, synchronize_session=False
        )

        if old_planting_ids:
            tasks = db.query(Task).filter(Task.planting_id.in_(old_planting_ids)).all()
            for task in tasks:
                action = task.title.split(": ", 1)[1] if ": " in task.title else task.title
                task.title = crop_task_title(stored_name, action, stored_variety)
                db.add(task)

    db.add(crop)
    db.commit()
    db.refresh(crop)
    return crop
