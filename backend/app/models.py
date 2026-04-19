from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("username", name="uq_users_username"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Garden(Base):
    __tablename__ = "gardens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    zip_code: Mapped[str] = mapped_column(String(12), index=True, default="")
    growing_zone: Mapped[str] = mapped_column(String(12), default="Unknown")
    yard_width_ft: Mapped[int] = mapped_column(Integer, default=20)
    yard_length_ft: Mapped[int] = mapped_column(Integer, default=20)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    orientation: Mapped[str] = mapped_column(String(16), default="south")
    sun_exposure: Mapped[str] = mapped_column(String(20), default="part_sun")
    wind_exposure: Mapped[str] = mapped_column(String(20), default="moderate")
    thermal_mass: Mapped[str] = mapped_column(String(20), default="moderate")
    slope_position: Mapped[str] = mapped_column(String(12), default="mid")
    frost_pocket_risk: Mapped[str] = mapped_column(String(20), default="low")
    address_private: Mapped[str] = mapped_column(String(255), default="")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    edge_buffer_in: Mapped[int] = mapped_column(Integer, default=6)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    beds = relationship("Bed", back_populates="garden", cascade="all, delete-orphan")


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    width_in: Mapped[int] = mapped_column(Integer)
    height_in: Mapped[int] = mapped_column(Integer)
    grid_x: Mapped[int] = mapped_column(Integer, default=0)
    grid_y: Mapped[int] = mapped_column(Integer, default=0)

    garden = relationship("Garden", back_populates="beds")


class CropTemplate(Base):
    __tablename__ = "crop_templates"
    __table_args__ = (UniqueConstraint("name", name="uq_crop_templates_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    variety: Mapped[str] = mapped_column(String(120), default="")
    source: Mapped[str] = mapped_column(String(60), default="manual", index=True)
    source_url: Mapped[str] = mapped_column(String(500), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    external_product_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    family: Mapped[str] = mapped_column(String(120), default="")
    spacing_in: Mapped[int] = mapped_column(Integer, default=12)
    row_spacing_in: Mapped[int] = mapped_column(Integer, default=18)
    in_row_spacing_in: Mapped[int] = mapped_column(Integer, default=12)
    planting_window: Mapped[str] = mapped_column(String(120), default="Spring")
    days_to_harvest: Mapped[int] = mapped_column(Integer, default=60)
    direct_sow: Mapped[bool] = mapped_column(Boolean, default=True)
    frost_hardy: Mapped[bool] = mapped_column(Boolean, default=False)
    weeks_to_transplant: Mapped[int] = mapped_column(Integer, default=6)
    notes: Mapped[str] = mapped_column(Text, default="")


class Planting(Base):
    __tablename__ = "plantings"
    __table_args__ = (UniqueConstraint("bed_id", "grid_x", "grid_y", name="uq_plantings_bed_grid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"), index=True)
    crop_name: Mapped[str] = mapped_column(String(120), index=True)
    grid_x: Mapped[int] = mapped_column(Integer)
    grid_y: Mapped[int] = mapped_column(Integer)
    color: Mapped[str] = mapped_column(String(20), default="#57a773")
    planted_on: Mapped[date] = mapped_column(Date)
    expected_harvest_on: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(20), default="direct_seed")
    location: Mapped[str] = mapped_column(String(20), default="in_bed")
    moved_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(120), default="")
    harvested_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    yield_notes: Mapped[str] = mapped_column(Text, default="")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    planting_id: Mapped[int] = mapped_column(ForeignKey("plantings.id"), index=True, nullable=True)
    bundled_planting_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    due_on: Mapped[date] = mapped_column(Date)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")


class SeedInventory(Base):
    __tablename__ = "seed_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop_name: Mapped[str] = mapped_column(String(120), index=True)
    supplier: Mapped[str] = mapped_column(String(120), default="")
    quantity_packets: Mapped[int] = mapped_column(Integer, default=0)


class PestLog(Base):
    __tablename__ = "pest_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    observed_on: Mapped[date] = mapped_column(Date)
    treatment: Mapped[str] = mapped_column(Text, default="")
    photo_path: Mapped[str] = mapped_column(String(255), default="")


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    bed_id: Mapped[int | None] = mapped_column(ForeignKey("beds.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    sensor_kind: Mapped[str] = mapped_column(String(40), index=True)
    unit: Mapped[str] = mapped_column(String(24), default="")
    location_label: Mapped[str] = mapped_column(String(120), default="")
    hardware_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), index=True)
    value: Mapped[float] = mapped_column(Float)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class UserAuthToken(Base):
    __tablename__ = "user_auth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class BackgroundJobState(Base):
    __tablename__ = "background_job_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="idle")
    is_running: Mapped[bool] = mapped_column(Boolean, default=False)
    message: Mapped[str] = mapped_column(String(500), default="")
    last_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    added: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    cleaned_legacy_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class CropSourceConfig(Base):
    __tablename__ = "crop_source_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
