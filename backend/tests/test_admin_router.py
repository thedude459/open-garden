import pytest
from fastapi import HTTPException

from app.models import CropSourceConfig
from app.routers.admin import (
    disable_user,
    list_crop_sources,
    list_users_admin,
    update_crop_source,
)
from app.schemas import CropSourceConfigUpdate


def test_list_users_admin_respects_offset_and_limit(db_session, user, other_user, admin_user):
    items = list_users_admin(skip=1, limit=2, db=db_session, _=admin_user)

    assert len(items) == 2
    assert {item.username for item in items} == {"admin", "other"}


def test_disable_user_marks_target_inactive(db_session, user, admin_user):
    disabled = disable_user(user_id=user.id, db=db_session, _=admin_user)

    assert disabled.is_active is False


def test_disable_user_rejects_missing_user(db_session, admin_user):
    with pytest.raises(HTTPException) as exc:
        disable_user(user_id=999, db=db_session, _=admin_user)

    assert exc.value.status_code == 404


def test_list_crop_sources_orders_primary_then_priority(db_session, admin_user):
    db_session.add(
        CropSourceConfig(
            source_key="johnnys-selected-seeds",
            display_name="Johnny's Selected Seeds",
            is_primary=True,
            is_enabled=True,
            priority=10,
        )
    )
    db_session.add(
        CropSourceConfig(
            source_key="high-mowing-seeds",
            display_name="High Mowing Organic Seeds",
            is_primary=False,
            is_enabled=True,
            priority=1,
        )
    )
    db_session.add(
        CropSourceConfig(
            source_key="example-seeds",
            display_name="Example Seeds",
            is_primary=False,
            is_enabled=True,
            priority=2,
        )
    )
    db_session.commit()

    items = list_crop_sources(db=db_session, _=admin_user)

    assert [item.source_key for item in items] == [
        "johnnys-selected-seeds",
        "high-mowing-seeds",
        "example-seeds",
    ]


def test_update_crop_source_can_promote_new_primary(db_session, admin_user):
    db_session.add(
        CropSourceConfig(
            source_key="johnnys-selected-seeds",
            display_name="Johnny's Selected Seeds",
            is_primary=True,
            is_enabled=True,
            priority=0,
        )
    )
    db_session.add(
        CropSourceConfig(
            source_key="high-mowing-seeds",
            display_name="High Mowing Organic Seeds",
            is_primary=False,
            is_enabled=True,
            priority=1,
        )
    )
    db_session.commit()

    updated = update_crop_source(
        source_key="high-mowing-seeds",
        payload=CropSourceConfigUpdate(is_primary=True),
        db=db_session,
        _=admin_user,
    )

    johnnys = (
        db_session.query(CropSourceConfig)
        .filter(CropSourceConfig.source_key == "johnnys-selected-seeds")
        .first()
    )
    assert updated.is_primary is True
    assert updated.is_enabled is True
    assert johnnys is not None
    assert johnnys.is_primary is False


def test_update_crop_source_rejects_demoting_primary_directly(db_session, admin_user):
    db_session.add(
        CropSourceConfig(
            source_key="johnnys-selected-seeds",
            display_name="Johnny's Selected Seeds",
            is_primary=True,
            is_enabled=True,
            priority=0,
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        update_crop_source(
            source_key="johnnys-selected-seeds",
            payload=CropSourceConfigUpdate(is_primary=False),
            db=db_session,
            _=admin_user,
        )

    assert exc.value.status_code == 422
