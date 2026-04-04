from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.models import CropTemplate, Placement, Planting, Task
from app.routers import crops
from app.schemas import CropTemplateCreate


def test_crop_name_helpers_split_and_normalize():
    assert crops.crop_name_parts("Tomato (Roma)", "Roma") == ("Tomato", "Roma")
    assert crops.crop_name_parts("Lettuce", "") == ("Lettuce", "")
    assert crops.normalized_crop_identity("Tomato (Roma)", "") == ("tomato", "roma")
    assert crops.normalized_crop_identity("Carrot", "Nantes") == ("carrot", "nantes")
    assert crops.canonical_crop_template_name("Tomato", "Roma") == ("Tomato (Roma)", "Roma")
    assert crops.canonical_crop_template_name("Carrot", "") == ("Carrot", "")
    assert crops.crop_task_title("Tomato (Roma)", "Harvest", "Roma") == "Tomato • Roma: Harvest"
    assert crops.crop_task_title("Carrot", "Harvest", "") == "Carrot: Harvest"


def test_create_crop_template_persists_manual_crop(db_session, user):
    created = crops.create_crop_template(
        payload=CropTemplateCreate(name="Pepper", variety="California Wonder", family="Solanaceae", spacing_in=18),
        db=db_session,
        _=user,
    )

    assert created.name == "Pepper (California Wonder)"
    assert created.source == "manual"


def test_create_crop_template_requires_name(db_session, user):
    with pytest.raises(HTTPException) as exc:
        crops.create_crop_template(payload=CropTemplateCreate(name="   "), db=db_session, _=user)

    assert exc.value.status_code == 400


def test_create_crop_template_rejects_duplicate_identity(db_session, crop_template, user):
    with pytest.raises(HTTPException) as exc:
        crops.create_crop_template(
            payload=CropTemplateCreate(name="Tomato", variety="Roma"),
            db=db_session,
            _=user,
        )

    assert exc.value.status_code == 409


def test_update_crop_template_renames_related_rows(db_session, crop_template, garden, bed, user):
    planting = Planting(
        garden_id=garden.id,
        bed_id=bed.id,
        crop_name=crop_template.name,
        planted_on=date.today(),
        expected_harvest_on=date.today() + timedelta(days=30),
        source="manual",
    )
    db_session.add(planting)
    db_session.commit()
    db_session.refresh(planting)
    db_session.add(Placement(garden_id=garden.id, bed_id=bed.id, crop_name=crop_template.name, grid_x=2, grid_y=2, planted_on=date.today(), color="#57a773"))
    db_session.add(Task(garden_id=garden.id, planting_id=planting.id, title="Tomato: Harvest", due_on=date.today(), notes=""))
    db_session.commit()

    updated = crops.update_crop_template(
        crop_id=crop_template.id,
        payload=CropTemplateCreate(name="Tomato", variety="San Marzano", family="Solanaceae", spacing_in=20),
        db=db_session,
        _=user,
    )

    assert updated.name == "Tomato (San Marzano)"
    assert db_session.query(Placement).filter(Placement.crop_name == "Tomato (San Marzano)").count() == 1
    assert db_session.query(Planting).filter(Planting.crop_name == "Tomato (San Marzano)").count() == 1
    assert db_session.query(Task).filter(Task.title == "Tomato • San Marzano: Harvest").count() == 1


def test_update_crop_template_rejects_missing_crop(db_session, user):
    with pytest.raises(HTTPException) as exc:
        crops.update_crop_template(crop_id=999, payload=CropTemplateCreate(name="Pepper"), db=db_session, _=user)

    assert exc.value.status_code == 404


def test_refresh_crop_templates_reports_running_job(db_session, user, monkeypatch):
    monkeypatch.setattr(crops, "start_crop_sync", lambda force_refresh: False)

    result = crops.refresh_crop_templates(db=db_session, _=user)

    assert result == {"message": "Crop database sync is already running."}


def test_refresh_crop_templates_reports_started_job(db_session, user, monkeypatch):
    monkeypatch.setattr(crops, "start_crop_sync", lambda force_refresh: True)

    result = crops.refresh_crop_templates(db=db_session, _=user)

    assert result == {"message": "Crop database sync started in the background."}


def test_cleanup_legacy_crop_templates_blocks_while_sync_is_running(db_session, user, monkeypatch):
    monkeypatch.setattr(crops, "ensure_crop_sync_state", lambda db: type("State", (), {"is_running": True})())

    with pytest.raises(HTTPException) as exc:
        crops.cleanup_legacy_crop_templates(db=db_session, _=user)

    assert exc.value.status_code == 409


def test_cleanup_legacy_crop_templates_reports_removed_count(db_session, user, monkeypatch):
    monkeypatch.setattr(crops, "ensure_crop_sync_state", lambda db: type("State", (), {"is_running": False})())
    monkeypatch.setattr(crops, "cleanup_legacy_starter_templates", lambda db: 3)
    updated = {}
    monkeypatch.setattr(crops, "update_crop_sync_state", lambda db, **kwargs: updated.update(kwargs))

    result = crops.cleanup_legacy_crop_templates(db=db_session, _=user)

    assert result == {"message": "Removed 3 legacy starter crop templates."}
    assert updated == {"cleaned_legacy_count": 3}


def test_crop_template_sync_status_reads_snapshot(db_session, user, monkeypatch):
    monkeypatch.setattr(crops, "get_crop_sync_state_snapshot", lambda db: {"status": "idle", "is_running": False, "message": "ok"})

    result = crops.crop_template_sync_status(_=user, db=db_session)

    assert result == {"status": "idle", "is_running": False, "message": "ok"}


def test_run_crop_sync_updates_failed_state(monkeypatch):
    calls = []

    class DummySession:
        def close(self):
            calls.append(("close",))

    dummy_db = DummySession()
    monkeypatch.setattr(crops, "SessionLocal", lambda: dummy_db)
    monkeypatch.setattr(crops, "seed_crop_templates", lambda db, force_refresh: (_ for _ in ()).throw(RuntimeError("boom")))
    monkeypatch.setattr(crops, "update_crop_sync_state", lambda db, **kwargs: calls.append(("update", kwargs)))
    monkeypatch.setattr(crops.logger, "exception", lambda *args, **kwargs: calls.append(("exception",)))

    crops._run_crop_sync(force_refresh=True)

    assert calls[0][1]["status"] == "running"
    assert any(call[0] == "exception" for call in calls)
    assert any(call[0] == "update" and call[1]["status"] == "failed" for call in calls)


def test_start_crop_sync_returns_false_when_state_is_running(monkeypatch):
    class DummySession:
        def close(self):
            return None

    monkeypatch.setattr(crops, "SessionLocal", lambda: DummySession())
    monkeypatch.setattr(crops, "ensure_crop_sync_state", lambda db: type("State", (), {"is_running": True})())

    assert crops.start_crop_sync(force_refresh=False) is False


def test_start_crop_sync_starts_background_thread(monkeypatch):
    calls = []

    class DummySession:
        def close(self):
            calls.append("close")

    class DummyThread:
        def __init__(self, target, args, daemon):
            calls.append(("thread", target, args, daemon))

        def start(self):
            calls.append("start")

    monkeypatch.setattr(crops, "SessionLocal", lambda: DummySession())
    monkeypatch.setattr(crops, "ensure_crop_sync_state", lambda db: type("State", (), {"is_running": False})())
    monkeypatch.setattr(crops, "update_crop_sync_state", lambda db, **kwargs: calls.append(("update", kwargs)))
    monkeypatch.setattr(crops, "Thread", DummyThread)

    started = crops.start_crop_sync(force_refresh=True)

    assert started is True
    assert ("update", {"is_running": True}) in calls
    assert any(entry[0] == "thread" and entry[2] == (True,) and entry[3] is True for entry in calls if isinstance(entry, tuple))
    assert "start" in calls


def test_run_crop_sync_updates_success_state(monkeypatch):
    calls = []

    class DummySession:
        def close(self):
            calls.append(("close",))

    dummy_db = DummySession()
    monkeypatch.setattr(crops, "SessionLocal", lambda: dummy_db)
    monkeypatch.setattr(crops, "seed_crop_templates", lambda db, force_refresh: {"added": 2, "updated": 1, "skipped": 0, "failed": 0})
    monkeypatch.setattr(crops, "update_crop_sync_state", lambda db, **kwargs: calls.append(("update", kwargs)))

    crops._run_crop_sync(force_refresh=False)

    assert calls[0][1]["status"] == "running"
    assert any(call[0] == "update" and call[1]["status"] == "succeeded" and call[1]["added"] == 2 for call in calls)


def test_list_crop_templates_returns_sorted_rows(db_session, user):
    db_session.add(CropTemplate(name="Zucchini", variety="", source="manual", source_url="", image_url="", external_product_id="", family="Cucurbitaceae", spacing_in=24, planting_window="Spring", days_to_harvest=55, direct_sow=True, frost_hardy=False, weeks_to_transplant=2, notes=""))
    db_session.add(CropTemplate(name="Bean", variety="", source="manual", source_url="", image_url="", external_product_id="", family="Fabaceae", spacing_in=6, planting_window="Spring", days_to_harvest=50, direct_sow=True, frost_hardy=False, weeks_to_transplant=1, notes=""))
    db_session.commit()

    items = crops.list_crop_templates(db=db_session, _=user)

    assert [item.name for item in items] == ["Bean", "Zucchini"]