CREATE TABLE IF NOT EXISTS gardens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  notes TEXT,
  hardiness_zone INTEGER,
  last_frost_month INTEGER,
  last_frost_day INTEGER,
  first_frost_month INTEGER,
  first_frost_day INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gardens_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT gardens_notes_len CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT gardens_zone_chk CHECK (
    hardiness_zone IS NULL OR (hardiness_zone BETWEEN 1 AND 13)
  ),
  CONSTRAINT gardens_last_frost_pair CHECK (
    (last_frost_month IS NULL AND last_frost_day IS NULL)
    OR (last_frost_month IS NOT NULL AND last_frost_day IS NOT NULL)
  ),
  CONSTRAINT gardens_first_frost_pair CHECK (
    (first_frost_month IS NULL AND first_frost_day IS NULL)
    OR (first_frost_month IS NOT NULL AND first_frost_day IS NOT NULL)
  ),
  CONSTRAINT gardens_frost_order CHECK (
    last_frost_month IS NULL
    OR first_frost_month IS NULL
    OR (last_frost_month, last_frost_day) < (first_frost_month, first_frost_day)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS gardens_owner_name_uidx
  ON gardens (owner_id, name_normalized);
CREATE INDEX IF NOT EXISTS gardens_owner_id_idx ON gardens (owner_id);

CREATE TABLE IF NOT EXISTS garden_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT garden_memberships_role_chk CHECK (
    role IN ('owner', 'collaborator', 'viewer')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS garden_memberships_garden_user_uidx
  ON garden_memberships (garden_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS garden_memberships_one_owner_uidx
  ON garden_memberships (garden_id)
  WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS garden_memberships_user_id_idx
  ON garden_memberships (user_id);
