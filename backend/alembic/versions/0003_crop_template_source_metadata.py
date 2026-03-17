"""Add source metadata for imported crop templates.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS source VARCHAR(60) DEFAULT 'manual'"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS source_url VARCHAR(500) DEFAULT ''"))
    op.execute(text("ALTER TABLE crop_templates ADD COLUMN IF NOT EXISTS external_product_id VARCHAR(64) DEFAULT ''"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_crop_templates_source ON crop_templates (source)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_crop_templates_external_product_id ON crop_templates (external_product_id)"))


def downgrade() -> None:
    # Intentionally non-destructive.
    pass