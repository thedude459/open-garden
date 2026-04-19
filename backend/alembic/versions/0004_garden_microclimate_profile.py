"""Add garden microclimate profile fields.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS orientation VARCHAR(16) DEFAULT 'south'")
    )
    op.execute(
        text(
            "ALTER TABLE gardens ADD COLUMN IF NOT EXISTS sun_exposure VARCHAR(20) DEFAULT 'part_sun'"
        )
    )
    op.execute(
        text(
            "ALTER TABLE gardens ADD COLUMN IF NOT EXISTS wind_exposure VARCHAR(20) DEFAULT 'moderate'"
        )
    )
    op.execute(
        text(
            "ALTER TABLE gardens ADD COLUMN IF NOT EXISTS thermal_mass VARCHAR(20) DEFAULT 'moderate'"
        )
    )
    op.execute(
        text(
            "ALTER TABLE gardens ADD COLUMN IF NOT EXISTS slope_position VARCHAR(12) DEFAULT 'mid'"
        )
    )
    op.execute(
        text(
            "ALTER TABLE gardens ADD COLUMN IF NOT EXISTS frost_pocket_risk VARCHAR(20) DEFAULT 'low'"
        )
    )


def downgrade() -> None:
    # Intentionally non-destructive.
    pass
