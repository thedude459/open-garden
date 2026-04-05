from app.services import (
    ensure_crop_sync_state,
    get_crop_sync_state_snapshot,
    update_crop_sync_state,
)


def test_crop_sync_state_persists_updates(db_session):
    state = ensure_crop_sync_state(db_session)
    assert state.job_key == "crop_template_sync"
    assert state.is_running is False

    update_crop_sync_state(
        db_session,
        status="running",
        is_running=True,
        message="syncing",
        added=1,
        updated=2,
        skipped=3,
        failed=0,
    )

    snapshot = get_crop_sync_state_snapshot(db_session)
    assert snapshot["status"] == "running"
    assert snapshot["is_running"] is True
    assert snapshot["message"] == "syncing"
    assert snapshot["added"] == 1
    assert snapshot["updated"] == 2
    assert snapshot["skipped"] == 3
