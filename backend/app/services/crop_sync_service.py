from datetime import datetime, timezone
from threading import Lock

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import BackgroundJobState


CROP_SYNC_JOB_KEY = "crop_template_sync"
_crop_sync_lock = Lock()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_crop_sync_state(db: Session) -> BackgroundJobState:
    state = (
        db.query(BackgroundJobState).filter(BackgroundJobState.job_key == CROP_SYNC_JOB_KEY).first()
    )
    if state is None:
        state = BackgroundJobState(
            job_key=CROP_SYNC_JOB_KEY,
            status="idle",
            is_running=False,
            message="Crop catalog sync has not run in this process yet.",
        )
        db.add(state)
        try:
            db.commit()
            db.refresh(state)
            return state
        except IntegrityError:
            # Another worker/process created the same singleton row first.
            db.rollback()
            state = (
                db.query(BackgroundJobState)
                .filter(BackgroundJobState.job_key == CROP_SYNC_JOB_KEY)
                .first()
            )
            if state is None:
                raise
    return state


def get_crop_sync_state_snapshot(db: Session) -> dict:
    with _crop_sync_lock:
        state = ensure_crop_sync_state(db)
        return {
            "status": state.status,
            "is_running": state.is_running,
            "message": state.message,
            "last_started_at": state.last_started_at.astimezone(timezone.utc).isoformat()
            if state.last_started_at
            else None,
            "last_finished_at": state.last_finished_at.astimezone(timezone.utc).isoformat()
            if state.last_finished_at
            else None,
            "added": state.added,
            "updated": state.updated,
            "skipped": state.skipped,
            "failed": state.failed,
            "cleaned_legacy_count": state.cleaned_legacy_count,
            "error": state.error,
        }


def update_crop_sync_state(db: Session, **changes) -> BackgroundJobState:
    with _crop_sync_lock:
        state = ensure_crop_sync_state(db)
        for key, value in changes.items():
            setattr(state, key, value)
        db.add(state)
        db.commit()
        db.refresh(state)
        return state
