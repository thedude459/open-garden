"""Initial column additions – captures all manual ALTER TABLE patches.

All statements use ADD COLUMN IF NOT EXISTS so this migration is safe to apply
against both fresh databases (where create_all already made the columns) and
pre-existing databases that were upgraded via the legacy startup DDL block.

Revision ID: 0001
Revises:
Create Date: 2026-03-14
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS zip_code VARCHAR(12) DEFAULT ''"))
    op.execute(text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS growing_zone VARCHAR(12) DEFAULT 'Unknown'"))
    op.execute(text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS yard_width_ft INTEGER DEFAULT 20"))
    op.execute(text("ALTER TABLE gardens ADD COLUMN IF NOT EXISTS yard_length_ft INTEGER DEFAULT 20"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS spacing_in INTEGER DEFAULT 12"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS planting_window VARCHAR(120) DEFAULT 'Spring'"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS direct_sow BOOLEAN DEFAULT TRUE"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS frost_hardy BOOLEAN DEFAULT FALSE"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS weeks_to_transplant INTEGER DEFAULT 6"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS family VARCHAR(120) DEFAULT ''"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''"))
    op.execute(text("ALTER TABLE plantings ADD COLUMN IF NOT EXISTS harvested_on DATE"))
    op.execute(text("ALTER TABLE plantings ADD COLUMN IF NOT EXISTS yield_notes TEXT DEFAULT ''"))


def downgrade() -> None:
    # Column removal is intentionally omitted – data loss risk.
    pass
