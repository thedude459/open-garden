import asyncio
from datetime import date, timedelta

import httpx
import pytest
from fastapi import HTTPException

from app.models import Bed, CropTemplate, Planting, Task
from app.services.planting_tasks import crop_task_title
from app.routers.planner import (
    create_bed,
    create_planting,
    delete_planting,
    get_planting_recommendations,
    list_beds,
    list_plantings,
    log_harvest,
    move_planting,
    relocate_planting,
    rotate_bed_in_yard,
    rename_bed,
    update_bed_position,
    update_planting_dates,
)
from app.schemas import (
    BedCreate,
    BedPositionUpdate,
    BedRenameUpdate,
    PlantingCreate,
    PlantingDatesUpdate,
    PlantingHarvestUpdate,
    PlantingMove,
    PlantingRelocate,
)


def _planting_payload(
    *,
    garden_id: int,
    bed_id: int,
    crop_name: str,
    grid_x: int,
    grid_y: int,
    planted_on: date | None = None,
    method: str = "direct_seed",
    location: str = "in_bed",
    source: str = "manual",
    color: str = "#57a773",
    moved_on: date | None = None,
) -> PlantingCreate:
    return PlantingCreate(
        garden_id=garden_id,
        bed_id=bed_id,
        crop_name=crop_name,
        grid_x=grid_x,
        grid_y=grid_y,
        color=color,
        planted_on=planted_on or date.today(),
        method=method,
        location=location,
        source=source,
        moved_on=moved_on,
    )


def test_create_and_list_beds(db_session, garden):
    created = create_bed(
        BedCreate(name="North", width_in=48, height_in=24, grid_x=1, grid_y=2),
        db=db_session,
        garden=garden,
    )
    items = list_beds(db=db_session, garden=garden)

    assert created.name == "North"
    assert [item.name for item in items] == ["North"]


def test_crop_task_title_normalizes_variety_suffix():
    assert crop_task_title("Tomato (Roma)", "Harvest", "Roma") == "Tomato • Roma: Harvest"
    assert crop_task_title("Carrot", "Thin") == "Carrot: Thin"


def test_update_bed_position_clamps_to_yard(db_session, bed):
    updated = update_bed_position(BedPositionUpdate(grid_x=99, grid_y=99), db=db_session, bed=bed)

    assert updated.grid_x == 17
    assert updated.grid_y == 17


def test_rename_bed_updates_name(db_session, bed):
    updated = rename_bed(BedRenameUpdate(name="Harvest Row"), db=db_session, bed=bed)

    assert updated.name == "Harvest Row"


def test_rename_bed_rejects_blank_name(db_session, bed):
    with pytest.raises(HTTPException) as exc:
        rename_bed(BedRenameUpdate(name="   "), db=db_session, bed=bed)

    assert exc.value.status_code == 422


def test_rotate_bed_swaps_dimensions(db_session, garden):
    rotatable = Bed(
        garden_id=garden.id, name="Rotate", width_in=12, height_in=24, grid_x=0, grid_y=0
    )
    db_session.add(rotatable)
    db_session.commit()
    db_session.refresh(rotatable)

    rotated = rotate_bed_in_yard(db=db_session, bed=rotatable)

    assert (rotated.width_in, rotated.height_in) == (24, 12)


def test_rotate_bed_rejects_edge_collision(db_session, garden):
    blocked = Bed(
        garden_id=garden.id, name="Blocked", width_in=12, height_in=48, grid_x=18, grid_y=0
    )
    db_session.add(blocked)
    db_session.commit()
    db_session.refresh(blocked)

    with pytest.raises(HTTPException) as exc:
        rotate_bed_in_yard(db=db_session, bed=blocked)

    assert exc.value.status_code == 409


def test_rotate_bed_rejects_overlap_with_other_bed(db_session, garden):
    rotatable = Bed(
        garden_id=garden.id, name="Rotate", width_in=12, height_in=24, grid_x=0, grid_y=0
    )
    blocker = Bed(
        garden_id=garden.id, name="Blocker", width_in=12, height_in=12, grid_x=1, grid_y=0
    )
    db_session.add_all([rotatable, blocker])
    db_session.commit()
    db_session.refresh(rotatable)

    with pytest.raises(HTTPException) as exc:
        rotate_bed_in_yard(db=db_session, bed=rotatable)

    assert exc.value.status_code == 409
    assert "overlap another bed" in exc.value.detail


def test_rotate_bed_rejects_out_of_bounds_planting(db_session, garden):
    rotatable = Bed(
        garden_id=garden.id, name="Rotate", width_in=12, height_in=24, grid_x=0, grid_y=0
    )
    db_session.add(rotatable)
    db_session.commit()
    db_session.refresh(rotatable)
    db_session.add(
        Planting(
            garden_id=garden.id,
            bed_id=rotatable.id,
            crop_name="Tomato",
            grid_x=99,
            grid_y=0,
            planted_on=date.today(),
            expected_harvest_on=date.today() + timedelta(days=60),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        rotate_bed_in_yard(db=db_session, bed=rotatable)

    assert exc.value.status_code == 409
    assert "outside the current bed bounds" in exc.value.detail


def test_delete_bed_removes_related_rows(db_session, bed, planting, sensor):
    from app.routers.planner import delete_bed

    planting_id = planting.id

    result = delete_bed(db=db_session, bed=bed)

    assert result == {"status": "deleted"}
    assert db_session.query(Planting).filter(Planting.id == planting_id).first() is None
    # Tasks are kept, their planting_id nulled
    assert db_session.query(Task).filter(Task.planting_id == planting_id).count() == 0
    db_session.refresh(sensor)
    assert sensor.bed_id is None


def test_move_planting_rejects_occupied_target(
    db_session, user, garden, bed, companion_crop_template, planting
):
    other = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=6,
            grid_y=6,
        ),
        db=db_session,
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        move_planting(
            PlantingMove(bed_id=bed.id, grid_x=other.grid_x, grid_y=other.grid_y),
            db=db_session,
            current_user=user,
            planting=planting,
        )

    assert exc.value.status_code == 409


def test_list_and_delete_plantings(
    db_session, user, garden, bed, companion_crop_template, planting
):
    second = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=6,
            grid_y=5,
        ),
        db=db_session,
        current_user=user,
    )

    listed = list_plantings(garden_id=garden.id, bed_id=bed.id, db=db_session, current_user=user)
    deleted = delete_planting(db=db_session, planting=second)

    assert planting.id in [item.id for item in listed]
    assert second.id in [item.id for item in listed]
    assert deleted == {"status": "deleted"}
    assert db_session.query(Planting).filter(Planting.id == second.id).first() is None


def test_list_plantings_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        list_plantings(garden_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_create_planting_rejects_edge_buffer_violation(db_session, user, garden, bed):
    with pytest.raises(HTTPException) as exc:
        create_planting(
            _planting_payload(
                garden_id=garden.id,
                bed_id=bed.id,
                crop_name="Carrot",
                grid_x=0,
                grid_y=0,
            ),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 409


def test_create_planting_rejects_missing_garden_or_bed(db_session, user, garden):
    with pytest.raises(HTTPException) as missing_garden:
        create_planting(
            _planting_payload(
                garden_id=999,
                bed_id=1,
                crop_name="Carrot",
                grid_x=2,
                grid_y=2,
            ),
            db=db_session,
            current_user=user,
        )
    with pytest.raises(HTTPException) as missing_bed:
        create_planting(
            _planting_payload(
                garden_id=garden.id,
                bed_id=999,
                crop_name="Carrot",
                grid_x=2,
                grid_y=2,
            ),
            db=db_session,
            current_user=user,
        )

    assert missing_garden.value.status_code == 404
    assert missing_bed.value.status_code == 404


def test_create_planting_rejects_spacing_conflict(
    db_session, user, garden, bed, crop_template, planting
):
    db_session.add(
        CropTemplate(
            name="Pepper",
            variety="",
            source="manual",
            source_url="",
            image_url="",
            external_product_id="",
            family="Solanaceae",
            spacing_in=18,
            planting_window="Spring",
            days_to_harvest=80,
            direct_sow=False,
            frost_hardy=False,
            weeks_to_transplant=8,
            notes="",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        create_planting(
            _planting_payload(
                garden_id=garden.id,
                bed_id=bed.id,
                crop_name="Pepper",
                grid_x=4,
                grid_y=3,
            ),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 409


def test_create_and_move_planting(db_session, user, garden, bed, companion_crop_template):
    created = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=2,
            grid_y=2,
        ),
        db=db_session,
        current_user=user,
    )

    moved = move_planting(
        PlantingMove(bed_id=bed.id, grid_x=5, grid_y=5),
        db=db_session,
        current_user=user,
        planting=created,
    )

    assert moved.grid_x == 5
    assert moved.grid_y == 5


def test_move_planting_rejects_missing_garden_or_target_bed(db_session, user, planting):
    db_session.query(Bed).filter(Bed.id == planting.bed_id).delete()
    db_session.query(Bed).filter(Bed.garden_id == planting.garden_id).delete()
    db_session.query(Bed).delete()
    db_session.query(Planting).filter(Planting.id == planting.id).update({Planting.garden_id: 999})
    db_session.commit()
    db_session.refresh(planting)

    with pytest.raises(HTTPException) as missing_garden:
        move_planting(
            PlantingMove(bed_id=1, grid_x=5, grid_y=5),
            db=db_session,
            current_user=user,
            planting=planting,
        )

    planting.garden_id = 1
    db_session.add(planting)
    db_session.commit()

    with pytest.raises(HTTPException) as missing_bed:
        move_planting(
            PlantingMove(bed_id=999, grid_x=5, grid_y=5),
            db=db_session,
            current_user=user,
            planting=planting,
        )

    assert missing_garden.value.status_code == 404
    assert missing_bed.value.status_code == 404


def test_create_planting_indoor_skips_in_bed_tracking(
    db_session, user, garden, bed, companion_crop_template
):
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=2,
            grid_y=2,
            location="indoor",
            method="transplant",
        ),
        db=db_session,
        current_user=user,
    )

    assert planting.location == "indoor"
    assert planting.method == "transplant"
    assert planting.moved_on is None


def test_relocate_planting_to_bed_stamps_moved_on(db_session, planting):
    result = relocate_planting(
        PlantingRelocate(location="in_bed"),
        db=db_session,
        planting=planting,
    )

    assert result.location == "in_bed"
    assert result.moved_on == date.today()


def test_relocate_planting_to_indoor_clears_moved_on(db_session, planting):
    planting.location = "in_bed"
    planting.moved_on = date.today()
    db_session.add(planting)
    db_session.commit()

    result = relocate_planting(
        PlantingRelocate(location="indoor"),
        db=db_session,
        planting=planting,
    )

    assert result.location == "indoor"
    assert result.moved_on is None


def test_create_planting_generates_care_tasks(db_session, user, garden, bed, crop_template):
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=4,
            grid_y=4,
            method="transplant",
        ),
        db=db_session,
        current_user=user,
    )

    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()

    assert planting.expected_harvest_on > planting.planted_on
    assert len(tasks) >= 6
    assert any("Start seeds indoors" in task.title for task in tasks)


def test_two_plantings_same_schedule_share_bundled_tasks(
    db_session, user, garden, bed, crop_template
):
    """Same crop + same bed-entry schedule → one auto-task row covering all placements."""
    started = date.today()
    create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=4,
            grid_y=4,
            planted_on=started,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )
    create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=9,
            grid_y=4,
            planted_on=started,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )

    planting_ids = {
        p.id for p in db_session.query(Planting).filter(Planting.garden_id == garden.id).all()
    }
    assert len(planting_ids) == 2

    tasks = db_session.query(Task).filter(Task.garden_id == garden.id).all()
    transplant = [t for t in tasks if "Transplant seedlings to bed" in t.title]
    assert len(transplant) == 1
    assert "(2 plantings)" in transplant[0].title
    assert set(transplant[0].bundled_planting_ids or []) == planting_ids


def test_delete_planting_succeeds_when_tasks_reference_canonical_planting_id(
    db_session, user, garden, bed, crop_template
):
    """Bundled tasks use ``planting_id`` = lowest id; deleting that row must not violate FK."""
    started = date.today()
    p1 = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=4,
            grid_y=4,
            planted_on=started,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )
    p2 = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=9,
            grid_y=4,
            planted_on=started,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )
    ids = sorted([p1.id, p2.id])
    first = db_session.query(Planting).filter(Planting.id == ids[0]).one()
    second = db_session.query(Planting).filter(Planting.id == ids[1]).one()
    delete_planting(db=db_session, planting=first)
    assert db_session.query(Planting).filter(Planting.id == ids[0]).first() is None
    delete_planting(db=db_session, planting=second)
    assert db_session.query(Planting).filter(Planting.garden_id == garden.id).count() == 0


def test_create_planting_indoor_skips_seed_start_task_and_dates_forward(
    db_session, user, garden, bed, crop_template
):
    """Indoor plantings should NOT get a 'Start seeds indoors' task (the
    planting itself is the evidence of starting), and downstream tasks
    should be derived forward from planted_on + weeks_to_transplant."""
    started_on = date.today()
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=4,
            grid_y=4,
            planted_on=started_on,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )

    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()
    titles = [task.title for task in tasks]

    assert not any("Start seeds indoors" in title for title in titles)

    weeks = max(1, crop_template.weeks_to_transplant or 6)
    expected_bed_entry = started_on + timedelta(days=weeks * 7)

    transplant_task = next((t for t in tasks if "Transplant seedlings to bed" in t.title), None)
    assert transplant_task is not None
    assert transplant_task.due_on == expected_bed_entry

    harden_task = next((t for t in tasks if "Harden off seedlings" in t.title), None)
    assert harden_task is not None
    assert harden_task.due_on == expected_bed_entry - timedelta(days=7)

    # Harvest should be derived from the bed-entry date, not the seed-start date.
    assert planting.expected_harvest_on > expected_bed_entry


def test_relocate_planting_to_bed_marks_transplant_task_done(
    db_session, user, garden, bed, crop_template
):
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=5,
            grid_y=5,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )

    transplant_task = (
        db_session.query(Task)
        .filter(
            Task.planting_id == planting.id,
            Task.title.like("%Transplant seedlings to bed%"),
        )
        .first()
    )
    assert transplant_task is not None
    assert transplant_task.is_done is False

    relocate_planting(
        PlantingRelocate(location="in_bed"),
        db=db_session,
        planting=planting,
    )

    new_transplant = (
        db_session.query(Task)
        .filter(
            Task.planting_id == planting.id,
            Task.title.like("%Transplant seedlings to bed%"),
        )
        .first()
    )
    assert new_transplant is not None
    assert new_transplant.is_done is True


def test_relocate_planting_in_bed_to_in_bed_does_not_alter_tasks(
    db_session, user, garden, bed, crop_template
):
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=6,
            grid_y=6,
            method="transplant",
            location="in_bed",
        ),
        db=db_session,
        current_user=user,
    )

    transplant_task = (
        db_session.query(Task)
        .filter(
            Task.planting_id == planting.id,
            Task.title.like("%Transplant seedlings to bed%"),
        )
        .first()
    )
    assert transplant_task is not None
    assert transplant_task.is_done is False

    relocate_planting(
        PlantingRelocate(location="in_bed"),
        db=db_session,
        planting=planting,
    )

    db_session.refresh(transplant_task)
    # Already in_bed → no transition, task should not be auto-completed.
    assert transplant_task.is_done is False


def test_create_indoor_planting_with_too_early_planned_move_clamps_to_minimum_seedling_age(
    db_session, user, garden, bed, crop_template
):
    """If planned move-to-bed is earlier than planted_on + weeks_to_transplant,
    anchor tasks on the minimum realistic transplant date."""
    started_on = date.today()
    too_soon = started_on + timedelta(days=14)
    weeks = max(1, crop_template.weeks_to_transplant or 6)
    effective = started_on + timedelta(days=weeks * 7)

    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=7,
            grid_y=7,
            planted_on=started_on,
            method="transplant",
            location="indoor",
            moved_on=too_soon,
        ),
        db=db_session,
        current_user=user,
    )

    assert planting.moved_on == effective
    transplant_task = (
        db_session.query(Task)
        .filter(
            Task.planting_id == planting.id,
            Task.title.like("%Transplant seedlings to bed%"),
        )
        .first()
    )
    assert transplant_task is not None
    assert transplant_task.due_on == effective


def test_create_indoor_planting_with_explicit_planned_transplant_date_anchors_tasks(
    db_session, user, garden, bed, crop_template
):
    """Winter-planning workflow: user starts seeds today and tells us they
    plan to move the seedlings into the bed on a specific (future) date.
    The transplant / harden-off / harvest tasks should anchor on the planned
    move date rather than `planted_on + weeks_to_transplant`."""
    started_on = date.today()
    planned_move = started_on + timedelta(days=70)

    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=7,
            grid_y=7,
            planted_on=started_on,
            method="transplant",
            location="indoor",
            moved_on=planned_move,
        ),
        db=db_session,
        current_user=user,
    )

    assert planting.moved_on == planned_move
    assert planting.expected_harvest_on == planned_move + timedelta(
        days=crop_template.days_to_harvest
    )

    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()
    transplant_task = next((t for t in tasks if "Transplant seedlings to bed" in t.title), None)
    harden_task = next((t for t in tasks if "Harden off seedlings" in t.title), None)
    assert transplant_task is not None and transplant_task.due_on == planned_move
    assert harden_task is not None and harden_task.due_on == planned_move - timedelta(days=7)


def test_update_planting_dates_shifts_planted_on_and_recomputes_harvest(
    db_session, user, garden, bed, crop_template
):
    started_on = date.today()
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=8,
            grid_y=8,
            planted_on=started_on,
            method="transplant",
            location="indoor",
        ),
        db=db_session,
        current_user=user,
    )

    new_started_on = started_on + timedelta(days=14)
    new_move_date = new_started_on + timedelta(days=42)

    updated = update_planting_dates(
        PlantingDatesUpdate(planted_on=new_started_on, moved_on=new_move_date),
        db=db_session,
        planting=planting,
    )

    weeks = max(1, crop_template.weeks_to_transplant or 6)
    effective_move = new_started_on + timedelta(days=weeks * 7)

    assert updated.planted_on == new_started_on
    assert updated.moved_on == effective_move
    assert updated.expected_harvest_on == effective_move + timedelta(
        days=crop_template.days_to_harvest
    )

    transplant_task = (
        db_session.query(Task)
        .filter(
            Task.planting_id == planting.id,
            Task.title.like("%Transplant seedlings to bed%"),
        )
        .first()
    )
    assert transplant_task is not None
    assert transplant_task.due_on == effective_move


def test_update_planting_dates_clear_moved_on_falls_back_to_default_offset(
    db_session, user, garden, bed, crop_template
):
    started_on = date.today()
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=9,
            grid_y=9,
            planted_on=started_on,
            method="transplant",
            location="indoor",
            moved_on=started_on + timedelta(days=80),
        ),
        db=db_session,
        current_user=user,
    )

    updated = update_planting_dates(
        PlantingDatesUpdate(clear_moved_on=True),
        db=db_session,
        planting=planting,
    )

    weeks = max(1, crop_template.weeks_to_transplant or 6)
    expected_default_entry = started_on + timedelta(days=weeks * 7)
    assert updated.moved_on is None
    assert updated.expected_harvest_on == expected_default_entry + timedelta(
        days=crop_template.days_to_harvest
    )


def test_update_planting_dates_in_bed_planting_uses_planted_on_as_anchor(
    db_session, user, garden, bed, crop_template
):
    planted_on = date.today() + timedelta(days=30)
    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            grid_x=8,
            grid_y=8,
            planted_on=date.today(),
            method="direct_seed",
            location="in_bed",
        ),
        db=db_session,
        current_user=user,
    )

    updated = update_planting_dates(
        PlantingDatesUpdate(planted_on=planted_on),
        db=db_session,
        planting=planting,
    )

    assert updated.planted_on == planted_on
    # in_bed plantings ignore moved_on — harvest is anchored on planted_on.
    assert updated.expected_harvest_on == planted_on + timedelta(days=crop_template.days_to_harvest)


def test_create_planting_direct_sow_without_template_uses_defaults(db_session, user, garden, bed):
    garden.growing_zone = "Unknown"
    db_session.add(garden)
    db_session.commit()

    planting = create_planting(
        _planting_payload(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name="Radish",
            grid_x=4,
            grid_y=4,
        ),
        db=db_session,
        current_user=user,
    )
    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()

    assert planting.expected_harvest_on == planting.planted_on + date.resolution * 60
    assert any("Direct sow seeds" in task.title for task in tasks)
    assert all("Harden off seedlings" not in task.title for task in tasks)
    assert any(task.notes.startswith("Expected ~day 60.") for task in tasks)


def test_list_plantings_returns_items_and_rejects_missing_garden(
    db_session, user, garden, planting
):
    items = list_plantings(garden_id=garden.id, db=db_session, current_user=user)

    with pytest.raises(HTTPException) as exc:
        list_plantings(garden_id=999, db=db_session, current_user=user)

    assert [item.id for item in items] == [planting.id]
    assert exc.value.status_code == 404


def test_log_harvest_updates_planting(db_session, planting):
    harvested = log_harvest(
        PlantingHarvestUpdate(harvested_on=date.today(), yield_notes="5 lb"),
        db=db_session,
        planting=planting,
    )

    assert harvested.harvested_on == date.today()
    assert harvested.yield_notes == "5 lb"


def test_get_planting_recommendations_returns_engine_output(monkeypatch, db_session, planting):
    async def fake_fetch_weather(latitude, longitude):
        return {"daily": {}}

    monkeypatch.setattr("app.routers.planner.fetch_weather", fake_fetch_weather)
    monkeypatch.setattr(
        "app.routers.planner.build_planting_recommendations",
        lambda *args: {"status": "ok", "planting_id": planting.id},
    )

    result = asyncio.run(get_planting_recommendations(db=db_session, planting=planting))

    assert result == {"status": "ok", "planting_id": planting.id}


def test_get_planting_recommendations_translates_weather_errors(monkeypatch, db_session, planting):
    async def fake_fetch_weather(latitude, longitude):
        raise httpx.RequestError("boom")

    monkeypatch.setattr("app.routers.planner.fetch_weather", fake_fetch_weather)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_planting_recommendations(db=db_session, planting=planting))

    assert exc.value.status_code == 502
