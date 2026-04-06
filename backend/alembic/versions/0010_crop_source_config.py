"""Add crop_source_configs table.

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS crop_source_configs (
                id SERIAL PRIMARY KEY,
                source_key VARCHAR(64) NOT NULL,
                display_name VARCHAR(120) NOT NULL DEFAULT '',
                is_primary BOOLEAN NOT NULL DEFAULT false,
                is_enabled BOOLEAN NOT NULL DEFAULT true,
                priority INTEGER NOT NULL DEFAULT 0
            )
            """
        )
    )
    op.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_crop_source_configs_source_key
            ON crop_source_configs (source_key)
            """
        )
    )
    op.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_crop_source_configs_source_key
            ON crop_source_configs (source_key)
            """
        )
    )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_crop_source_configs_source_key"))
    op.execute(text("DROP INDEX IF EXISTS uq_crop_source_configs_source_key"))
    op.execute(text("DROP TABLE IF EXISTS crop_source_configs"))
