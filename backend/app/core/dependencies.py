from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import get_current_user
from ..database import get_db
from ..models import Bed, Garden, Planting, Sensor, Task, User


def get_owned_garden(
    garden_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Garden:
    garden = (
        db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return garden


def get_owned_bed(
    bed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Bed:
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if bed is None:
        raise HTTPException(status_code=404, detail="Bed not found")

    garden = (
        db.query(Garden)
        .filter(Garden.id == bed.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return bed


def get_owned_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    garden = (
        db.query(Garden)
        .filter(Garden.id == task.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    return task


def get_owned_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Sensor:
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if sensor is None:
        raise HTTPException(status_code=404, detail="Sensor not found")

    garden = (
        db.query(Garden)
        .filter(Garden.id == sensor.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=403, detail="Forbidden")
    return sensor


def get_owned_planting(
    planting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Planting:
    planting = db.query(Planting).filter(Planting.id == planting_id).first()
    if planting is None:
        raise HTTPException(status_code=404, detail="Planting not found")

    garden = (
        db.query(Garden)
        .filter(Garden.id == planting.garden_id, Garden.owner_id == current_user.id)
        .first()
    )
    if garden is None:
        raise HTTPException(status_code=403, detail="Forbidden")
    return planting
