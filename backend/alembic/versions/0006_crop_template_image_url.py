"""Add image URL metadata for crop templates.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-21
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT ''"))


def downgrade() -> None:
    # Intentionally non-destructive.
    pass
