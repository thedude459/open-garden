from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    Base,
    Bed,
    CropTemplate,
    Garden,
    Planting,
    Sensor,
    SensorReading,
    Task,
    User,
)


TEST_TODAY = date(2026, 4, 5)
TEST_NOW_UTC = datetime(2026, 4, 5, 12, 0, tzinfo=timezone.utc)


def pytest_collection_modifyitems(items):
    classified_markers = {"unit", "integration"}
    for item in items:
        if not any(marker.name in classified_markers for marker in item.iter_markers()):
            item.add_marker(pytest.mark.unit)


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def fixed_today() -> date:
    return TEST_TODAY


@pytest.fixture()
def fixed_now_utc() -> datetime:
    return TEST_NOW_UTC


@pytest.fixture()
def user(db_session: Session) -> User:
    item = User(
        email="test@example.com",
        username="tester",
        hashed_password="hashed",
        email_verified=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def other_user(db_session: Session) -> User:
    item = User(
        email="other@example.com",
        username="other",
        hashed_password="hashed",
        email_verified=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def garden(db_session: Session, user: User) -> Garden:
    item = Garden(
        owner_id=user.id,
        name="Test Garden",
        description="",
        zip_code="94110",
        growing_zone="10b",
        yard_width_ft=20,
        yard_length_ft=20,
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
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def admin_user(db_session: Session) -> User:
    item = User(
        email="admin@example.com",
        username="admin",
        hashed_password="hashed",
        email_verified=True,
        is_admin=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def bed(db_session: Session, garden: Garden) -> Bed:
    item = Bed(
        garden_id=garden.id,
        name="Bed 1",
        width_in=36,
        height_in=36,
        grid_x=0,
        grid_y=0,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def crop_template(db_session: Session) -> CropTemplate:
    item = CropTemplate(
        name="Tomato (Roma)",
        variety="Roma",
        source="manual",
        source_url="",
        image_url="",
        external_product_id="",
        family="Solanaceae",
        spacing_in=18,
        planting_window="Spring",
        days_to_harvest=75,
        direct_sow=False,
        frost_hardy=False,
        weeks_to_transplant=8,
        notes="Stake early.",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def companion_crop_template(db_session: Session) -> CropTemplate:
    item = CropTemplate(
        name="Carrot",
        variety="Napoli",
        source="manual",
        source_url="",
        image_url="",
        external_product_id="",
        family="Apiaceae",
        spacing_in=6,
        planting_window="Spring",
        days_to_harvest=60,
        direct_sow=True,
        frost_hardy=True,
        weeks_to_transplant=1,
        notes="",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def planting(
    db_session: Session, garden: Garden, bed: Bed, crop_template: CropTemplate
) -> Planting:
    planted_on = TEST_TODAY - timedelta(days=10)
    item = Planting(
        garden_id=garden.id,
        bed_id=bed.id,
        crop_name=crop_template.name,
        grid_x=3,
        grid_y=3,
        color="#57a773",
        planted_on=planted_on,
        expected_harvest_on=planted_on + timedelta(days=crop_template.days_to_harvest),
        method="direct_seed",
        location="in_bed",
        source="manual",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def task(db_session: Session, garden: Garden, planting: Planting) -> Task:
    item = Task(
        garden_id=garden.id,
        planting_id=planting.id,
        title="Check moisture",
        due_on=TEST_TODAY,
        is_done=False,
        notes="",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def sensor(db_session: Session, garden: Garden, bed: Bed) -> Sensor:
    item = Sensor(
        garden_id=garden.id,
        bed_id=bed.id,
        name="Probe A",
        sensor_kind="soil_moisture",
        unit="%",
        location_label="north row",
        hardware_id="probe-a",
        is_active=True,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture()
def sensor_reading(db_session: Session, sensor: Sensor) -> SensorReading:
    item = SensorReading(
        sensor_id=sensor.id,
        value=28.0,
        captured_at=TEST_NOW_UTC,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item
