import pytest
from fastapi import HTTPException

from app.core.dependencies import get_owned_garden
from app.core.dependencies import get_owned_bed, get_owned_placement, get_owned_planting, get_owned_sensor, get_owned_task
from app.models import Sensor, Task


def test_get_owned_garden_returns_garden(db_session, user, garden):
    result = get_owned_garden(garden_id=garden.id, db=db_session, current_user=user)
    assert result.id == garden.id


def test_get_owned_garden_rejects_non_owner(db_session, other_user, garden):
    with pytest.raises(HTTPException) as exc:
        get_owned_garden(garden_id=garden.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 404


def test_get_owned_bed_returns_bed(db_session, user, bed):
    assert get_owned_bed(bed_id=bed.id, db=db_session, current_user=user).id == bed.id


def test_get_owned_bed_rejects_missing_bed(db_session, user):
    with pytest.raises(HTTPException) as exc:
        get_owned_bed(bed_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_get_owned_bed_rejects_non_owner(db_session, other_user, bed):
    with pytest.raises(HTTPException) as exc:
        get_owned_bed(bed_id=bed.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 404


def test_get_owned_placement_returns_placement(db_session, user, placement):
    assert get_owned_placement(placement_id=placement.id, db=db_session, current_user=user).id == placement.id


def test_get_owned_placement_rejects_missing_placement(db_session, user):
    with pytest.raises(HTTPException) as exc:
        get_owned_placement(placement_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_get_owned_placement_rejects_non_owner(db_session, other_user, placement):
    with pytest.raises(HTTPException) as exc:
        get_owned_placement(placement_id=placement.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 404


def test_get_owned_task_rejects_non_owner(db_session, other_user, task):
    with pytest.raises(HTTPException) as exc:
        get_owned_task(task_id=task.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 403


def test_get_owned_task_rejects_missing_task(db_session, user):
    with pytest.raises(HTTPException) as exc:
        get_owned_task(task_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_get_owned_sensor_rejects_non_owner(db_session, other_user, sensor):
    with pytest.raises(HTTPException) as exc:
        get_owned_sensor(sensor_id=sensor.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 403


def test_get_owned_sensor_returns_sensor(db_session, user, sensor):
    assert get_owned_sensor(sensor_id=sensor.id, db=db_session, current_user=user).id == sensor.id


def test_get_owned_sensor_rejects_missing_sensor(db_session, user):
    with pytest.raises(HTTPException) as exc:
        get_owned_sensor(sensor_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404


def test_get_owned_planting_returns_planting(db_session, user, planting):
    assert get_owned_planting(planting_id=planting.id, db=db_session, current_user=user).id == planting.id


def test_get_owned_planting_rejects_non_owner(db_session, other_user, planting):
    with pytest.raises(HTTPException) as exc:
        get_owned_planting(planting_id=planting.id, db=db_session, current_user=other_user)

    assert exc.value.status_code == 403


def test_get_owned_planting_rejects_missing_planting(db_session, user):
    with pytest.raises(HTTPException) as exc:
        get_owned_planting(planting_id=999, db=db_session, current_user=user)

    assert exc.value.status_code == 404
