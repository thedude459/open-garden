from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import create_engine, inspect

from app.config import settings


pytestmark = pytest.mark.integration


_POSTGRES_ONLY_REASON = "Migration smoke tests run only against PostgreSQL."


def _alembic_config() -> AlembicConfig:
    root = Path(__file__).resolve().parents[2]
    cfg = AlembicConfig(str(root / "backend" / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "backend" / "alembic"))
    return cfg


@pytest.mark.skipif(
    not settings.database_url.startswith("postgresql+"),
    reason=_POSTGRES_ONLY_REASON,
)
def test_alembic_upgrade_head_creates_core_tables():
    database_url = settings.database_url

    cfg = _alembic_config()
    command.upgrade(cfg, "head")

    engine = create_engine(database_url, future=True)
    try:
        table_names = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()

    expected_tables = {
        "users",
        "gardens",
        "beds",
        "crop_templates",
        "placements",
        "plantings",
        "tasks",
        "sensors",
        "sensor_readings",
        "user_auth_tokens",
        "crop_sync_state",
    }
    assert expected_tables.issubset(table_names)


@pytest.mark.skipif(
    not settings.database_url.startswith("postgresql+"),
    reason=_POSTGRES_ONLY_REASON,
)
def test_alembic_upgrade_head_is_idempotent():
    cfg = _alembic_config()
    command.upgrade(cfg, "head")
    command.upgrade(cfg, "head")
