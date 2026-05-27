"""Add bundled_planting_ids JSON to tasks for merged schedule rows.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-19

When several plantings share the same crop, variety, and bed-entry schedule,
auto-generated care tasks are stored once with this array listing every
planting id in the batch.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    task_cols = {c["name"] for c in inspect(bind).get_columns("tasks")}
    if "bundled_planting_ids" not in task_cols:
        op.add_column("tasks", sa.Column("bundled_planting_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "bundled_planting_ids")
