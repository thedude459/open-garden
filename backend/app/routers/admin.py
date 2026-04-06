from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth import get_admin_user
from ..database import get_db
from ..models import CropSourceConfig, User
from ..schemas import CropSourceConfigOut, CropSourceConfigUpdate, UserOut

router = APIRouter(tags=["admin"])


@router.get("/admin/users", response_model=list[UserOut])
def list_users_admin(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return db.query(User).offset(skip).limit(limit).all()


@router.post("/admin/users/{user_id}/disable", response_model=UserOut)
def disable_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/admin/crop-sources", response_model=list[CropSourceConfigOut])
def list_crop_sources(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return (
        db.query(CropSourceConfig)
        .order_by(CropSourceConfig.is_primary.desc(), CropSourceConfig.priority.asc())
        .all()
    )


@router.patch("/admin/crop-sources/{source_key}", response_model=CropSourceConfigOut)
def update_crop_source(
    source_key: str,
    payload: CropSourceConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    config = db.query(CropSourceConfig).filter(CropSourceConfig.source_key == source_key).first()
    if config is None:
        raise HTTPException(status_code=404, detail="Crop source not found")

    if payload.is_primary is True:
        # Atomically demote any existing primary.
        db.query(CropSourceConfig).filter(
            CropSourceConfig.is_primary.is_(True),
            CropSourceConfig.source_key != source_key,
        ).update({"is_primary": False, "is_enabled": True})
        config.is_primary = True
        config.is_enabled = True
    elif payload.is_primary is False and config.is_primary:
        raise HTTPException(
            status_code=422,
            detail="Cannot demote the primary source directly. Set another source as primary first.",
        )

    if payload.is_enabled is not None and not config.is_primary:
        config.is_enabled = payload.is_enabled

    if payload.priority is not None:
        config.priority = payload.priority

    db.commit()
    db.refresh(config)
    return config
