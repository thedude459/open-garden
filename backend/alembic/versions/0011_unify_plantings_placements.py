"""Unify plantings and placements into a single table.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-18

Wipe-and-reset migration (per product decision). Drops both the legacy
``placements`` table and the old ``plantings`` table, then recreates the
unified ``plantings`` table that owns both agronomy and spatial info.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Null out any task FKs to plantings so we can drop the table cleanly.
    op.execute(text("UPDATE tasks SET planting_id = NULL WHERE planting_id IS NOT NULL"))

    op.execute(text("DROP INDEX IF EXISTS uq_placements_bed_grid"))
    op.execute(text("DROP TABLE IF EXISTS placements CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS plantings CASCADE"))

    op.execute(
        text(
            """
            CREATE TABLE plantings (
                id SERIAL PRIMARY KEY,
                garden_id INTEGER NOT NULL REFERENCES gardens(id),
                bed_id INTEGER NOT NULL REFERENCES beds(id),
                crop_name VARCHAR(120) NOT NULL,
                grid_x INTEGER NOT NULL,
                grid_y INTEGER NOT NULL,
                color VARCHAR(20) NOT NULL DEFAULT '#57a773',
                planted_on DATE NOT NULL,
                expected_harvest_on DATE NOT NULL,
                method VARCHAR(20) NOT NULL DEFAULT 'direct_seed',
                location VARCHAR(20) NOT NULL DEFAULT 'in_bed',
                moved_on DATE NULL,
                source VARCHAR(120) NOT NULL DEFAULT '',
                harvested_on DATE NULL,
                yield_notes TEXT NOT NULL DEFAULT ''
            )
            """
        )
    )
    op.execute(
        text("CREATE UNIQUE INDEX uq_plantings_bed_grid ON plantings (bed_id, grid_x, grid_y)")
    )
    op.execute(text("CREATE INDEX ix_plantings_garden_id ON plantings (garden_id)"))
    op.execute(text("CREATE INDEX ix_plantings_bed_id ON plantings (bed_id)"))
    op.execute(text("CREATE INDEX ix_plantings_crop_name ON plantings (crop_name)"))

    op.execute(
        text(
            """
            ALTER TABLE tasks
                ADD CONSTRAINT tasks_planting_id_fkey
                FOREIGN KEY (planting_id) REFERENCES plantings(id)
            """
        )
    )


def downgrade() -> None:
    op.execute(text("UPDATE tasks SET planting_id = NULL WHERE planting_id IS NOT NULL"))
    op.execute(text("DROP INDEX IF EXISTS ix_plantings_crop_name"))
    op.execute(text("DROP INDEX IF EXISTS ix_plantings_bed_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_plantings_garden_id"))
    op.execute(text("DROP INDEX IF EXISTS uq_plantings_bed_grid"))
    op.execute(text("DROP TABLE IF EXISTS plantings CASCADE"))

    op.execute(
        text(
            """
            CREATE TABLE plantings (
                id SERIAL PRIMARY KEY,
                garden_id INTEGER NOT NULL REFERENCES gardens(id),
                bed_id INTEGER NOT NULL REFERENCES beds(id),
                crop_name VARCHAR(120) NOT NULL,
                planted_on DATE NOT NULL,
                expected_harvest_on DATE NOT NULL,
                source VARCHAR(120) NOT NULL DEFAULT '',
                harvested_on DATE NULL,
                yield_notes TEXT NOT NULL DEFAULT ''
            )
            """
        )
    )
    op.execute(
        text(
            """
            CREATE TABLE placements (
                id SERIAL PRIMARY KEY,
                garden_id INTEGER NOT NULL REFERENCES gardens(id),
                bed_id INTEGER NOT NULL REFERENCES beds(id),
                crop_name VARCHAR(120) NOT NULL,
                grid_x INTEGER NOT NULL,
                grid_y INTEGER NOT NULL,
                color VARCHAR(20) NOT NULL DEFAULT '#57a773',
                planted_on DATE NOT NULL
            )
            """
        )
    )
    op.execute(
        text("CREATE UNIQUE INDEX uq_placements_bed_grid ON placements (bed_id, grid_x, grid_y)")
    )
    op.execute(
        text(
            """
            ALTER TABLE tasks
                ADD CONSTRAINT tasks_planting_id_fkey
                FOREIGN KEY (planting_id) REFERENCES plantings(id)
            """
        )
    )
