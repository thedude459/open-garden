"""Garden observation journal entries and crop life_cycle tagging.

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_GARDEN_OBS_GARDEN_ID = "ix_garden_observations_garden_id"


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    observations_created = False
    if not insp.has_table("garden_observations"):
        observations_created = True
        op.create_table(
            "garden_observations",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("garden_id", sa.Integer(), nullable=False),
            sa.Column("observed_on", sa.Date(), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("notes", sa.Text(), nullable=False),
            sa.Column("photo_url", sa.String(length=500), nullable=False, server_default=""),
            sa.Column(
                "planting_id",
                sa.Integer(),
                sa.ForeignKey("plantings.id"),
                nullable=True,
            ),
            sa.Column("bed_id", sa.Integer(), sa.ForeignKey("beds.id"), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
        )

    if observations_created:
        op.create_index(
            op.f(_INDEX_GARDEN_OBS_GARDEN_ID),
            "garden_observations",
            ["garden_id"],
        )
    else:
        idx_names = {ix["name"] for ix in insp.get_indexes("garden_observations")}
        if _INDEX_GARDEN_OBS_GARDEN_ID not in idx_names:
            op.create_index(
                op.f(_INDEX_GARDEN_OBS_GARDEN_ID),
                "garden_observations",
                ["garden_id"],
            )

    crop_cols = {c["name"] for c in insp.get_columns("crop_templates")}
    if "life_cycle" not in crop_cols:
        op.add_column(
            "crop_templates",
            sa.Column(
                "life_cycle",
                sa.String(length=32),
                nullable=False,
                server_default="annual",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if insp.has_table("garden_observations"):
        idx_names = {ix["name"] for ix in insp.get_indexes("garden_observations")}
        if _INDEX_GARDEN_OBS_GARDEN_ID in idx_names:
            op.drop_index(op.f(_INDEX_GARDEN_OBS_GARDEN_ID), table_name="garden_observations")
        op.drop_table("garden_observations")

    crop_cols = {c["name"] for c in insp.get_columns("crop_templates")}
    if "life_cycle" in crop_cols:
        op.drop_column("crop_templates", "life_cycle")
