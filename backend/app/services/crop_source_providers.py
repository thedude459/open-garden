"""Protocol and normalized record for crop source providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from .spacing_providers import SpacingProvider


@dataclass(slots=True)
class NormalizedCropRecord:
    canonical_name: str
    variety: str
    source_key: str
    source_url: str
    image_url: str
    external_product_id: str
    family: str
    spacing_in: int
    row_spacing_in: int
    in_row_spacing_in: int
    planting_window: str
    days_to_harvest: int
    direct_sow: bool
    frost_hardy: bool
    weeks_to_transplant: int
    notes: str


class CropSourceProvider(Protocol):
    @property
    def source_key(self) -> str: ...

    @property
    def display_name(self) -> str: ...

    def fetch_crops(self, spacing_provider: SpacingProvider) -> list[NormalizedCropRecord]: ...
