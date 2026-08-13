CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_key TEXT NOT NULL,
  common_name TEXT NOT NULL,
  species TEXT NOT NULL,
  cultivar TEXT,
  plant_type TEXT NOT NULL,
  zone_min INTEGER NOT NULL,
  zone_max INTEGER NOT NULL,
  sun_requirements TEXT,
  water_needs TEXT,
  days_to_maturity INTEGER,
  spacing_inches INTEGER,
  provider TEXT,
  provider_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS plants_variety_key_uidx ON plants(variety_key);
CREATE INDEX IF NOT EXISTS plants_plant_type_idx ON plants(plant_type);
CREATE INDEX IF NOT EXISTS plants_zone_idx ON plants(zone_min, zone_max);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_mutation_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_plant_uidx ON favorites(user_id, plant_id);

CREATE TABLE IF NOT EXISTS catalog_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT NOT NULL,
  provider TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  plants_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
