from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import text
from sqlalchemy import create_engine

from app.config import settings
from app.database import Base
from app.database import SessionLocal
from app.models import Garden, User


pytestmark = pytest.mark.integration


def _alembic_config() -> AlembicConfig:
    root = Path(__file__).resolve().parents[2]
    cfg = AlembicConfig(str(root / "backend" / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "backend" / "alembic"))
    return cfg


def _bootstrap_base_schema(database_url: str) -> None:
    engine = create_engine(database_url, future=True)
    try:
        Base.metadata.create_all(bind=engine)
    finally:
        engine.dispose()


@pytest.mark.skipif(
    not settings.database_url.startswith("postgresql+"),
    reason="Postgres smoke test only runs when DATABASE_URL points to PostgreSQL.",
)
def test_postgres_database_url_is_used_for_postgres_job():
    assert settings.database_url.startswith("postgresql+")


@pytest.mark.skipif(
    not settings.database_url.startswith("postgresql+"),
    reason="Postgres smoke test only runs when DATABASE_URL points to PostgreSQL.",
)
def test_postgres_round_trip_query():
    with SessionLocal() as session:
        value = session.execute(text("SELECT 1")).scalar_one()

    assert value == 1


@pytest.mark.skipif(
    not settings.database_url.startswith("postgresql+"),
    reason="Postgres smoke test only runs when DATABASE_URL points to PostgreSQL.",
)
def test_postgres_migration_and_crud_round_trip():
    _bootstrap_base_schema(settings.database_url)

    cfg = _alembic_config()
    command.upgrade(cfg, "head")

    uid = uuid4().hex[:12]
    with SessionLocal() as session:
        user = User(
            email=f"pg-smoke-{uid}@example.com",
            username=f"pg-smoke-{uid}",
            hashed_password="hashed",
            email_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        garden = Garden(
            owner_id=user.id,
            name="PG Smoke Garden",
            description="",
            zip_code="94110",
            growing_zone="10b",
            yard_width_ft=12,
            yard_length_ft=12,
            latitude=37.7,
            longitude=-122.4,
            orientation="south",
            sun_exposure="part_sun",
            wind_exposure="moderate",
            thermal_mass="moderate",
            slope_position="mid",
            frost_pocket_risk="low",
            address_private="",
            is_shared=False,
            edge_buffer_in=6,
        )
        session.add(garden)
        session.commit()

        fetched = (
            session.query(Garden)
            .filter(Garden.owner_id == user.id, Garden.name == "PG Smoke Garden")
            .one()
        )

    assert fetched.name == "PG Smoke Garden"
