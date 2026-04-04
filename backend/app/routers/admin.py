from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth import get_admin_user
from ..database import get_db
from ..models import User
from ..schemas import UserOut

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
