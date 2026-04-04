from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..database import get_db
from ..core.dependencies import get_owned_task
from ..models import Garden, PestLog, SeedInventory, Task, User
from ..schemas import (
    PestLogCreate,
    PestLogOut,
    SeedInventoryCreate,
    SeedInventoryOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

router = APIRouter(tags=["tasks"])


@router.post("/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    task = Task(**payload.model_dump(), planting_id=None)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(garden_id: int, q: str = Query("", min_length=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")

    query = db.query(Task).filter(Task.garden_id == garden_id)
    if q:
        like_q = f"%{q.lower()}%"
        query = query.filter(or_(Task.title.ilike(like_q), Task.notes.ilike(like_q)))
    return query.order_by(Task.due_on.asc()).all()


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(payload: TaskUpdate, db: Session = Depends(get_db), task: Task = Depends(get_owned_task)):
    if payload.is_done is not None:
        task.is_done = payload.is_done
    if payload.title is not None:
        task.title = payload.title
    if payload.due_on is not None:
        task.due_on = payload.due_on
    if payload.notes is not None:
        task.notes = payload.notes
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(db: Session = Depends(get_db), task: Task = Depends(get_owned_task)):
    db.delete(task)
    db.commit()


@router.post("/seed-inventory", response_model=SeedInventoryOut)
def add_seed_inventory(payload: SeedInventoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = SeedInventory(user_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/seed-inventory", response_model=list[SeedInventoryOut])
def list_seed_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SeedInventory).filter(SeedInventory.user_id == current_user.id).all()


@router.post("/pest-logs", response_model=PestLogOut)
def create_pest_log(payload: PestLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == payload.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    item = PestLog(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/pest-logs", response_model=list[PestLogOut])
def list_pest_logs(garden_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=404, detail="Garden not found")
    return db.query(PestLog).filter(PestLog.garden_id == garden_id).all()


@router.delete("/pest-logs/{pest_log_id}")
def delete_pest_log(pest_log_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pest_log = db.query(PestLog).filter(PestLog.id == pest_log_id).first()
    if pest_log is None:
        raise HTTPException(status_code=404, detail="Pest log entry not found")
    garden = db.query(Garden).filter(Garden.id == pest_log.garden_id, Garden.owner_id == current_user.id).first()
    if garden is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(pest_log)
    db.commit()
    return {"status": "deleted"}
