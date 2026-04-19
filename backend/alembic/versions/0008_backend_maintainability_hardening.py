"""Harden backend persistence for maintainability.

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-04
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS background_job_states (
                id SERIAL PRIMARY KEY,
                job_key VARCHAR(100) UNIQUE NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'idle',
                is_running BOOLEAN NOT NULL DEFAULT FALSE,
                message VARCHAR(500) NOT NULL DEFAULT '',
                last_started_at TIMESTAMPTZ NULL,
                last_finished_at TIMESTAMPTZ NULL,
                added INTEGER NOT NULL DEFAULT 0,
                updated INTEGER NOT NULL DEFAULT 0,
                skipped INTEGER NOT NULL DEFAULT 0,
                failed INTEGER NOT NULL DEFAULT 0,
                cleaned_legacy_count INTEGER NOT NULL DEFAULT 0,
                error TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_background_job_states_job_key ON background_job_states (job_key)"
        )
    )

    op.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_placements_bed_grid ON placements (bed_id, grid_x, grid_y)"
        )
    )
    op.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email)"))
    op.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username)"))
    op.execute(
        text("CREATE UNIQUE INDEX IF NOT EXISTS uq_crop_templates_name ON crop_templates (name)")
    )


def downgrade() -> None:
    # Intentionally non-destructive.
    pass
