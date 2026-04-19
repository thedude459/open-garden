"""Delete stale 'Start seeds indoors' auto-tasks for indoor plantings.

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-19

After we changed the semantics of ``planted_on`` for indoor plantings to mean
"date the seed was started indoors", the auto-generated "Start seeds indoors"
task is redundant for any planting that was created with ``location='indoor'``
(creating that planting *is* the act of starting the seeds). Remove the
back-dated, perpetually-overdue tasks left behind by the previous logic.

This is a one-shot cleanup: future indoor plantings won't generate the task
in the first place, so re-running this migration is a no-op for new data.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            DELETE FROM tasks
            WHERE planting_id IN (
                SELECT id FROM plantings WHERE location = 'indoor'
            )
            AND title LIKE '%Start seeds indoors%'
            """
        )
    )


def downgrade() -> None:
    # Cleanup-only migration; restoring the deleted tasks is not meaningful
    # because the dates were derived from the now-defunct semantics.
    pass
