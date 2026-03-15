"""Add user email verification fields and auth token table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"))
    op.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP"))
    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_auth_tokens (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id),
              purpose VARCHAR(32) NOT NULL,
              token_hash VARCHAR(128) NOT NULL UNIQUE,
              expires_at TIMESTAMP NOT NULL,
              used_at TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_user_auth_tokens_user_id ON user_auth_tokens (user_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_user_auth_tokens_purpose ON user_auth_tokens (purpose)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_user_auth_tokens_expires_at ON user_auth_tokens (expires_at)"))


def downgrade() -> None:
    # Intentionally no destructive downgrade to avoid data loss in auth tables.
    pass
