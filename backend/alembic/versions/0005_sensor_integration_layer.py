"""Add sensor integration tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-17
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS sensors (
                id SERIAL PRIMARY KEY,
                garden_id INTEGER NOT NULL REFERENCES gardens(id),
                bed_id INTEGER NULL REFERENCES beds(id),
                name VARCHAR(120) NOT NULL,
                sensor_kind VARCHAR(40) NOT NULL,
                unit VARCHAR(24) NOT NULL DEFAULT '',
                location_label VARCHAR(120) NOT NULL DEFAULT '',
                hardware_id VARCHAR(120) NOT NULL DEFAULT '',
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensors_garden_id ON sensors (garden_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensors_bed_id ON sensors (bed_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensors_sensor_kind ON sensors (sensor_kind)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensors_hardware_id ON sensors (hardware_id)"))

    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id SERIAL PRIMARY KEY,
                sensor_id INTEGER NOT NULL REFERENCES sensors(id),
                value DOUBLE PRECISION NOT NULL,
                captured_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensor_readings_sensor_id ON sensor_readings (sensor_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_sensor_readings_captured_at ON sensor_readings (captured_at)"))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_sensor_readings_captured_at"))
    op.execute(text("DROP INDEX IF EXISTS ix_sensor_readings_sensor_id"))
    op.execute(text("DROP TABLE IF EXISTS sensor_readings"))

    op.execute(text("DROP INDEX IF EXISTS ix_sensors_hardware_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_sensors_sensor_kind"))
    op.execute(text("DROP INDEX IF EXISTS ix_sensors_bed_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_sensors_garden_id"))
    op.execute(text("DROP TABLE IF EXISTS sensors"))
