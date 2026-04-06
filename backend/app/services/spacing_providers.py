"""Spacing provider abstraction.

Defines the SpacingProvider protocol and a concrete implementation sourced
from Johnny's Selected Seeds growing guides.  To use a different data source
in the future, implement SpacingProvider and pass it into seed_crop_templates().
"""

from __future__ import annotations

from typing import Protocol


class SpacingProvider(Protocol):
    """Returns (row_spacing_in, in_row_spacing_in) for a given crop."""

    def get_row_and_in_row_spacing(self, crop_name: str, root_segment: str) -> tuple[int, int]:
        """Return (row_spacing_in, in_row_spacing_in) in inches."""
        ...


class JohnnysSeedingSpacingProvider:
    """Spacing figures sourced from Johnny's Selected Seeds Key Growing Information pages.

    Row spacing reflects the recommended distance between rows; in-row spacing
    reflects the recommended distance between plants within a row.  Values are
    the mid-point of any stated range in the Johnny's guides.

    Sources consulted (April 2026):
    - https://www.johnnyseeds.com/growers-library/vegetables/*/…-key-growing-information.html
    - https://www.johnnyseeds.com/growers-library/vegetables/carrots/
        carrot-bed-preparation-spacing-weeding-watering.html
    - https://www.johnnyseeds.com/growers-library/vegetables/tomatoes/
        tomatoes-key-growing-information.html
    """

    # keyword → row spacing in inches
    ROW_SPACING_OVERRIDES: dict[str, int] = {
        "artichoke": 60,
        "asparagus": 48,
        "basil": 18,
        "bean": 18,
        "beet": 12,
        "blackberry": 96,
        "blueberry": 120,
        "broccoli": 18,
        "brussels sprout": 24,
        "cabbage": 24,
        "calendula": 12,
        "carrot": 18,
        "cauliflower": 24,
        "celery": 18,
        "cilantro": 12,
        "corn": 30,
        "cosmos": 18,
        "cucumber": 48,
        "dill": 12,
        "eggplant": 30,
        "garlic": 12,
        "kale": 18,
        "lavender": 24,
        "leek": 12,
        "lettuce": 12,
        "marigold": 12,
        "melon": 72,
        "mint": 18,
        "nasturtium": 12,
        "okra": 36,
        "onion": 12,
        "parsley": 12,
        "pea": 18,
        "pepper": 24,
        "pumpkin": 96,
        "radish": 12,
        "raspberry": 96,
        "rosemary": 24,
        "sage": 24,
        "spinach": 12,
        "squash": 48,
        "strawberry": 24,
        "sunflower": 24,
        "swiss chard": 18,
        "thyme": 12,
        "tomatillo": 36,
        "tomato": 60,
        "watermelon": 96,
        "zinnia": 12,
    }

    # keyword → in-row spacing in inches
    IN_ROW_SPACING_OVERRIDES: dict[str, int] = {
        "artichoke": 36,
        "asparagus": 18,
        "basil": 12,
        "bean": 4,
        "beet": 3,
        "blackberry": 36,
        "blueberry": 48,
        "broccoli": 18,
        "brussels sprout": 18,
        "cabbage": 18,
        "calendula": 10,
        "carrot": 2,
        "cauliflower": 18,
        "celery": 10,
        "cilantro": 6,
        "corn": 12,
        "cosmos": 12,
        "cucumber": 12,
        "dill": 9,
        "eggplant": 18,
        "garlic": 6,
        "kale": 15,
        "lavender": 18,
        "leek": 6,
        "lettuce": 10,
        "marigold": 8,
        "melon": 30,
        "mint": 18,
        "nasturtium": 12,
        "okra": 18,
        "onion": 4,
        "parsley": 8,
        "pea": 4,
        "pepper": 18,
        "pumpkin": 48,
        "radish": 2,
        "raspberry": 30,
        "rosemary": 18,
        "sage": 16,
        "spinach": 6,
        "squash": 36,
        "strawberry": 12,
        "sunflower": 18,
        "swiss chard": 12,
        "thyme": 10,
        "tomatillo": 24,
        "tomato": 24,
        "watermelon": 36,
        "zinnia": 12,
    }

    # defaults by root segment when no keyword match found
    _SEGMENT_DEFAULTS: dict[str, tuple[int, int]] = {
        "flowers": (12, 10),
        "fruits": (60, 24),
        "herbs": (12, 10),
    }
    _DEFAULT: tuple[int, int] = (18, 12)

    def get_row_and_in_row_spacing(self, crop_name: str, root_segment: str) -> tuple[int, int]:
        normalized = crop_name.strip().lower()
        for keyword, row_in in self.ROW_SPACING_OVERRIDES.items():
            if keyword in normalized:
                in_row = self.IN_ROW_SPACING_OVERRIDES.get(keyword, self._DEFAULT[1])
                return (row_in, in_row)
        return self._SEGMENT_DEFAULTS.get(root_segment, self._DEFAULT)


def get_default_spacing_provider() -> SpacingProvider:
    """Return the default (Johnny's) spacing provider."""
    return JohnnysSeedingSpacingProvider()
