import pytest
from fastapi import HTTPException

from app.routers.admin import disable_user, list_users_admin


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