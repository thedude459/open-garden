"""Add row_spacing_in and in_row_spacing_in to crop_templates.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-06
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            "ALTER TABLE crop_templates "
            "ADD COLUMN IF NOT EXISTS row_spacing_in INTEGER NOT NULL DEFAULT 18"
        )
    )
    op.execute(
        text(
            "ALTER TABLE crop_templates "
            "ADD COLUMN IF NOT EXISTS in_row_spacing_in INTEGER NOT NULL DEFAULT 12"
        )
    )


def downgrade() -> None:
    # Intentionally non-destructive.
    pass
