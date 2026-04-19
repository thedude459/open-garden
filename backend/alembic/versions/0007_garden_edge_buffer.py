"""Add configurable garden edge buffer.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-22
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS edge_buffer_in INTEGER DEFAULT 6")
    )
    op.execute(text("UPDATE gardens SET edge_buffer_in = 6 WHERE edge_buffer_in IS NULL"))
    op.execute(text("ALTER TABLE gardens ALTER COLUMN edge_buffer_in SET NOT NULL"))


def downgrade() -> None:
    # Intentionally non-destructive.
    pass
