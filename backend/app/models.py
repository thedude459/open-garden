from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
    address_private: Mapped[str] = mapped_column(String(255), default="")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    variety: Mapped[str] = mapped_column(String(120), default="")
    family: Mapped[str] = mapped_column(String(120), default="")
    spacing_in: Mapped[int] = mapped_column(Integer, default=12)
    planting_window: Mapped[str] = mapped_column(String(120), default="Spring")
    days_to_harvest: Mapped[int] = mapped_column(Integer, default=60)
    direct_sow: Mapped[bool] = mapped_column(Boolean, default=True)
    frost_hardy: Mapped[bool] = mapped_column(Boolean, default=False)
    weeks_to_transplant: Mapped[int] = mapped_column(Integer, default=6)
    notes: Mapped[str] = mapped_column(Text, default="")


class Planting(Base):
    __tablename__ = "plantings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"), index=True)
    crop_name: Mapped[str] = mapped_column(String(120), index=True)
    planted_on: Mapped[date] = mapped_column(Date)
    expected_harvest_on: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(120), default="")
    harvested_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    yield_notes: Mapped[str] = mapped_column(Text, default="")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    planting_id: Mapped[int] = mapped_column(ForeignKey("plantings.id"), index=True, nullable=True)
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


class Placement(Base):
    __tablename__ = "placements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    garden_id: Mapped[int] = mapped_column(ForeignKey("gardens.id"), index=True)
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"), index=True)
    crop_name: Mapped[str] = mapped_column(String(120), index=True)
    grid_x: Mapped[int] = mapped_column(Integer)
    grid_y: Mapped[int] = mapped_column(Integer)
    color: Mapped[str] = mapped_column(String(20), default="#57a773")
    planted_on: Mapped[date] = mapped_column(Date)


class UserAuthToken(Base):
    __tablename__ = "user_auth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
