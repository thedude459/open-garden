"""Add crop_templates.plant_kind for suggestion filtering.

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_IX_PLANT_KIND = "ix_crop_templates_plant_kind"


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("crop_templates")}
    if "plant_kind" not in cols:
        op.add_column(
            "crop_templates",
            sa.Column(
                "plant_kind",
                sa.String(length=32),
                nullable=False,
                server_default="vegetable",
            ),
        )
        op.create_index(_IX_PLANT_KIND, "crop_templates", ["plant_kind"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("crop_templates")}
    if "plant_kind" in cols:
        ix_names = {ix["name"] for ix in insp.get_indexes("crop_templates")}
        if _IX_PLANT_KIND in ix_names:
            op.drop_index(_IX_PLANT_KIND, table_name="crop_templates")
        op.drop_column("crop_templates", "plant_kind")
