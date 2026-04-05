from datetime import date

import pytest
from fastapi import HTTPException

from app.models import PestLog, Task
from app.routers.tasks import (
    add_seed_inventory,
    create_pest_log,
    create_task,
    delete_pest_log,
    delete_task,
    list_pest_logs,
    list_seed_inventory,
    list_tasks,
    update_task,
)
from app.schemas import PestLogCreate, SeedInventoryCreate, TaskCreate, TaskUpdate


def test_task_router_create_and_list(db_session, user, garden):
    payload = TaskCreate(garden_id=garden.id, title="Water bed", due_on=date.today(), notes="n")
    created = create_task(payload=payload, db=db_session, current_user=user)

    items = list_tasks(garden_id=garden.id, q="water", db=db_session, current_user=user)
    assert created.id is not None
    assert len(items) == 1
    assert items[0].title == "Water bed"


def test_task_router_update_marks_done(db_session, user, garden):
    task = Task(
        garden_id=garden.id,
        planting_id=None,
        title="Weed",
        due_on=date.today(),
        is_done=False,
        notes="",
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    updated = update_task(payload=TaskUpdate(is_done=True), db=db_session, task=task)
    assert updated.is_done is True


def test_task_router_update_all_optional_fields(db_session, garden):
    task = Task(
        garden_id=garden.id,
        planting_id=None,
        title="Old",
        due_on=date.today(),
        is_done=False,
        notes="old",
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    due = date.today().replace(day=max(1, date.today().day))
    updated = update_task(
        payload=TaskUpdate(is_done=True, title="New", due_on=due, notes="new notes"),
        db=db_session,
        task=task,
    )

    assert updated.title == "New"
    assert updated.due_on == due
    assert updated.notes == "new notes"


def test_delete_task_removes_task(db_session, task):
    delete_task(db=db_session, task=task)

    assert db_session.query(Task).filter(Task.id == task.id).first() is None


def test_seed_inventory_round_trip(db_session, user):
    created = add_seed_inventory(
        payload=SeedInventoryCreate(crop_name="Carrot", supplier="Johnny's", quantity_packets=2),
        db=db_session,
        current_user=user,
    )

    items = list_seed_inventory(db=db_session, current_user=user)

    assert created.user_id == user.id
    assert [(item.crop_name, item.quantity_packets) for item in items] == [("Carrot", 2)]


def test_list_tasks_without_search_returns_sorted(db_session, user, garden):
    early = create_task(
        payload=TaskCreate(garden_id=garden.id, title="Early", due_on=date(2026, 1, 1), notes="a"),
        db=db_session,
        current_user=user,
    )
    late = create_task(
        payload=TaskCreate(garden_id=garden.id, title="Late", due_on=date(2026, 2, 1), notes="b"),
        db=db_session,
        current_user=user,
    )

    items = list_tasks(garden_id=garden.id, q="", db=db_session, current_user=user)

    assert [item.id for item in items] == [early.id, late.id]


def test_list_tasks_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        list_tasks(garden_id=999, q="", db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_pest_log_create_and_delete(db_session, user, garden):
    created = create_pest_log(
        payload=PestLogCreate(
            garden_id=garden.id, title="Aphids", observed_on=date.today(), treatment="Soap"
        ),
        db=db_session,
        current_user=user,
    )

    deleted = delete_pest_log(created.id, db=db_session, current_user=user)

    assert deleted == {"status": "deleted"}


def test_list_pest_logs_returns_entries(db_session, user, garden):
    db_session.add(
        PestLog(
            garden_id=garden.id,
            title="Aphids",
            observed_on=date.today(),
            treatment="Soap",
            photo_path="",
        )
    )
    db_session.commit()

    items = list_pest_logs(garden_id=garden.id, db=db_session, current_user=user)

    assert len(items) == 1
    assert items[0].title == "Aphids"


def test_pest_log_delete_rejects_non_owner(db_session, other_user, garden):
    created = create_pest_log(
        payload=PestLogCreate(
            garden_id=garden.id, title="Aphids", observed_on=date.today(), treatment="Soap"
        ),
        db=db_session,
        current_user=type("UserStub", (), {"id": garden.owner_id})(),
    )

    with pytest.raises(HTTPException) as exc:
        delete_pest_log(created.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 403


def test_pest_log_delete_rejects_missing_entry(db_session, user):
    with pytest.raises(HTTPException) as exc:
        delete_pest_log(999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_create_task_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        create_task(
            payload=TaskCreate(garden_id=999, title="Water bed", due_on=date.today()),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 404


def test_list_pest_logs_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        list_pest_logs(garden_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_create_pest_log_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        create_pest_log(
            payload=PestLogCreate(garden_id=999, title="Aphids", observed_on=date.today()),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 404
