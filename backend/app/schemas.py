from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    email_verified: bool
    is_admin: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class MessageOut(BaseModel):
    message: str


class VerifyEmailPayload(BaseModel):
    token: str


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str


class GardenCreate(BaseModel):
    name: str
    description: str = ""
    zip_code: str
    yard_width_ft: int = 20
    yard_length_ft: int = 20
    address_private: str = ""
    is_shared: bool = False


class GardenOut(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str
    zip_code: str
    growing_zone: str
    yard_width_ft: int
    yard_length_ft: int
    latitude: float
    longitude: float
    is_shared: bool

    model_config = ConfigDict(from_attributes=True)


class CropTemplateCreate(BaseModel):
    name: str
    variety: str = ""
    family: str = ""
    spacing_in: int = 12
    days_to_harvest: int = 60
    planting_window: str = "Spring"
    direct_sow: bool = True
    frost_hardy: bool = False
    weeks_to_transplant: int = 6
    notes: str = ""


class CropTemplateOut(BaseModel):
    id: int
    name: str
    variety: str
    family: str
    spacing_in: int
    days_to_harvest: int
    planting_window: str
    direct_sow: bool
    frost_hardy: bool
    weeks_to_transplant: int
    notes: str

    model_config = ConfigDict(from_attributes=True)


class BedCreate(BaseModel):
    name: str
    width_in: int
    height_in: int
    grid_x: int = 0
    grid_y: int = 0


class BedOut(BaseModel):
    id: int
    garden_id: int
    name: str
    width_in: int
    height_in: int
    grid_x: int
    grid_y: int

    model_config = ConfigDict(from_attributes=True)


class GardenYardUpdate(BaseModel):
    yard_width_ft: int
    yard_length_ft: int


class BedPositionUpdate(BaseModel):
    grid_x: int
    grid_y: int


class PlantingCreate(BaseModel):
    garden_id: int
    bed_id: int
    crop_name: str
    planted_on: date
    source: str = ""


class PlantingOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int
    crop_name: str
    planted_on: date
    expected_harvest_on: date
    source: str
    harvested_on: date | None = None
    yield_notes: str = ""

    model_config = ConfigDict(from_attributes=True)


class PlantingHarvestUpdate(BaseModel):
    harvested_on: date
    yield_notes: str = ""


class TaskCreate(BaseModel):
    garden_id: int
    title: str
    due_on: date
    notes: str = ""


class TaskOut(BaseModel):
    id: int
    garden_id: int
    planting_id: int | None
    title: str
    due_on: date
    is_done: bool
    notes: str

    model_config = ConfigDict(from_attributes=True)


class TaskUpdate(BaseModel):
    is_done: bool | None = None
    title: str | None = None
    due_on: date | None = None
    notes: str | None = None


class SeedInventoryCreate(BaseModel):
    crop_name: str
    supplier: str = ""
    quantity_packets: int = 0


class SeedInventoryOut(BaseModel):
    id: int
    user_id: int
    crop_name: str
    supplier: str
    quantity_packets: int

    model_config = ConfigDict(from_attributes=True)


class PestLogCreate(BaseModel):
    garden_id: int
    title: str
    observed_on: date
    treatment: str = ""
    photo_path: str = ""


class PestLogOut(BaseModel):
    id: int
    garden_id: int
    title: str
    observed_on: date
    treatment: str
    photo_path: str

    model_config = ConfigDict(from_attributes=True)


class PlacementCreate(BaseModel):
    garden_id: int
    bed_id: int
    crop_name: str
    grid_x: int
    grid_y: int
    color: str = "#57a773"
    planted_on: date


class PlacementMove(BaseModel):
    bed_id: int
    grid_x: int
    grid_y: int


class PlacementOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int
    crop_name: str
    grid_x: int
    grid_y: int
    color: str
    planted_on: date

    model_config = ConfigDict(from_attributes=True)
