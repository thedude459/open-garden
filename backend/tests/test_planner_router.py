import asyncio
from datetime import date

import httpx
import pytest
from fastapi import HTTPException

from app.models import Bed, CropTemplate, Placement, Task
from app.routers.planner import (
    _crop_task_title,
    create_bed,
    create_placement,
    create_planting,
    delete_placement,
    get_planting_recommendations,
    list_beds,
    list_placements,
    list_plantings,
    log_harvest,
    move_placement,
    rotate_bed_in_yard,
    rename_bed,
    update_bed_position,
)
from app.schemas import (
    BedCreate,
    BedPositionUpdate,
    BedRenameUpdate,
    PlacementCreate,
    PlacementMove,
    PlantingCreate,
    PlantingHarvestUpdate,
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
    assert _crop_task_title("Tomato (Roma)", "Harvest", "Roma") == "Tomato • Roma: Harvest"
    assert _crop_task_title("Carrot", "Thin") == "Carrot: Thin"


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


def test_rotate_bed_rejects_out_of_bounds_placement(db_session, garden):
    rotatable = Bed(
        garden_id=garden.id, name="Rotate", width_in=12, height_in=24, grid_x=0, grid_y=0
    )
    db_session.add(rotatable)
    db_session.commit()
    db_session.refresh(rotatable)
    db_session.add(
        Placement(
            garden_id=garden.id,
            bed_id=rotatable.id,
            crop_name="Tomato",
            grid_x=99,
            grid_y=0,
            planted_on=date.today(),
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        rotate_bed_in_yard(db=db_session, bed=rotatable)

    assert exc.value.status_code == 409
    assert "outside the current bed bounds" in exc.value.detail


def test_delete_bed_removes_related_rows(db_session, bed, placement, planting, sensor):
    from app.routers.planner import delete_bed

    placement_id = placement.id
    planting_id = planting.id

    result = delete_bed(db=db_session, bed=bed)

    assert result == {"status": "deleted"}
    assert db_session.query(Placement).filter(Placement.id == placement_id).first() is None
    assert db_session.query(Task).filter(Task.planting_id == planting_id).count() == 0
    db_session.refresh(sensor)
    assert sensor.bed_id is None


def test_move_placement_rejects_occupied_target(
    db_session, user, garden, bed, companion_crop_template, placement
):
    other = create_placement(
        PlacementCreate(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=6,
            grid_y=6,
            planted_on=date.today(),
        ),
        db=db_session,
        current_user=user,
    )

    with pytest.raises(HTTPException) as exc:
        move_placement(
            PlacementMove(bed_id=bed.id, grid_x=other.grid_x, grid_y=other.grid_y),
            db=db_session,
            current_user=user,
            placement=placement,
        )

    assert exc.value.status_code == 409


def test_list_and_delete_placements(
    db_session, user, garden, bed, companion_crop_template, placement
):
    second = create_placement(
        PlacementCreate(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=6,
            grid_y=5,
            planted_on=date.today(),
        ),
        db=db_session,
        current_user=user,
    )

    listed = list_placements(garden_id=garden.id, bed_id=bed.id, db=db_session, current_user=user)
    deleted = delete_placement(db=db_session, placement=second)

    assert [item.id for item in listed] == [placement.id, second.id]
    assert deleted == {"status": "deleted"}
    assert db_session.query(Placement).filter(Placement.id == second.id).first() is None


def test_list_placements_rejects_missing_garden(db_session, user):
    with pytest.raises(HTTPException) as exc:
        list_placements(garden_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_create_placement_rejects_edge_buffer_violation(db_session, user, garden, bed):
    with pytest.raises(HTTPException) as exc:
        create_placement(
            PlacementCreate(
                garden_id=garden.id,
                bed_id=bed.id,
                crop_name="Carrot",
                grid_x=0,
                grid_y=0,
                planted_on=date.today(),
            ),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 409


def test_create_placement_rejects_missing_garden_or_bed(db_session, user, garden):
    with pytest.raises(HTTPException) as missing_garden:
        create_placement(
            PlacementCreate(
                garden_id=999,
                bed_id=1,
                crop_name="Carrot",
                grid_x=2,
                grid_y=2,
                planted_on=date.today(),
            ),
            db=db_session,
            current_user=user,
        )
    with pytest.raises(HTTPException) as missing_bed:
        create_placement(
            PlacementCreate(
                garden_id=garden.id,
                bed_id=999,
                crop_name="Carrot",
                grid_x=2,
                grid_y=2,
                planted_on=date.today(),
            ),
            db=db_session,
            current_user=user,
        )

    assert missing_garden.value.status_code == 404
    assert missing_bed.value.status_code == 404


def test_create_placement_rejects_spacing_conflict(
    db_session, user, garden, bed, crop_template, placement
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
        create_placement(
            PlacementCreate(
                garden_id=garden.id,
                bed_id=bed.id,
                crop_name="Pepper",
                grid_x=4,
                grid_y=3,
                planted_on=date.today(),
            ),
            db=db_session,
            current_user=user,
        )

    assert exc.value.status_code == 409


def test_create_and_move_placement(db_session, user, garden, bed, companion_crop_template):
    created = create_placement(
        PlacementCreate(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=companion_crop_template.name,
            grid_x=2,
            grid_y=2,
            planted_on=date.today(),
        ),
        db=db_session,
        current_user=user,
    )

    moved = move_placement(
        PlacementMove(bed_id=bed.id, grid_x=5, grid_y=5),
        db=db_session,
        current_user=user,
        placement=created,
    )

    assert moved.grid_x == 5
    assert moved.grid_y == 5


def test_move_placement_rejects_missing_garden_or_target_bed(db_session, user, placement):
    db_session.query(Bed).filter(Bed.id == placement.bed_id).delete()
    db_session.query(Bed).filter(Bed.garden_id == placement.garden_id).delete()
    db_session.query(Bed).delete()
    db_session.query(Placement).filter(Placement.id == placement.id).update(
        {Placement.garden_id: 999}
    )
    db_session.commit()
    db_session.refresh(placement)

    with pytest.raises(HTTPException) as missing_garden:
        move_placement(
            PlacementMove(bed_id=1, grid_x=5, grid_y=5),
            db=db_session,
            current_user=user,
            placement=placement,
        )

    placement.garden_id = 1
    db_session.add(placement)
    db_session.commit()

    with pytest.raises(HTTPException) as missing_bed:
        move_placement(
            PlacementMove(bed_id=999, grid_x=5, grid_y=5),
            db=db_session,
            current_user=user,
            placement=placement,
        )

    assert missing_garden.value.status_code == 404
    assert missing_bed.value.status_code == 404


def test_create_planting_generates_care_tasks(db_session, user, garden, bed, crop_template):
    planting = create_planting(
        PlantingCreate(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name=crop_template.name,
            planted_on=date.today(),
            source="manual",
        ),
        db=db_session,
        current_user=user,
    )

    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()

    assert planting.expected_harvest_on > planting.planted_on
    assert len(tasks) >= 6
    assert any("Start seeds indoors" in task.title for task in tasks)


def test_create_planting_direct_sow_without_template_uses_defaults(db_session, user, garden, bed):
    garden.growing_zone = "Unknown"
    db_session.add(garden)
    db_session.commit()

    planting = create_planting(
        PlantingCreate(
            garden_id=garden.id,
            bed_id=bed.id,
            crop_name="Radish",
            planted_on=date.today(),
            source="manual",
        ),
        db=db_session,
        current_user=user,
    )
    tasks = db_session.query(Task).filter(Task.planting_id == planting.id).all()

    assert planting.expected_harvest_on == planting.planted_on + date.resolution * 60
    assert any("Direct sow seeds" in task.title for task in tasks)
    assert all("Harden off seedlings" not in task.title for task in tasks)
    assert any(task.notes.startswith("Expected ~day 60.") for task in tasks)


def test_create_planting_rejects_missing_garden_or_bed(db_session, user, garden):
    with pytest.raises(HTTPException) as missing_garden:
        create_planting(
            PlantingCreate(
                garden_id=999,
                bed_id=1,
                crop_name="Tomato",
                planted_on=date.today(),
                source="manual",
            ),
            db=db_session,
            current_user=user,
        )
    with pytest.raises(HTTPException) as missing_bed:
        create_planting(
            PlantingCreate(
                garden_id=garden.id,
                bed_id=999,
                crop_name="Tomato",
                planted_on=date.today(),
                source="manual",
            ),
            db=db_session,
            current_user=user,
        )

    assert missing_garden.value.status_code == 404
    assert missing_bed.value.status_code == 404


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
