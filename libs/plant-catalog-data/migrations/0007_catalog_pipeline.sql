CREATE TABLE IF NOT EXISTS catalog_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by text NOT NULL CHECK (triggered_by IN ('operator', 'schedule')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'incomplete')),
  plants_upserted integer NOT NULL DEFAULT 0,
  plants_deprecated integer NOT NULL DEFAULT 0,
  plants_reactivated integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_pipeline_runs_one_running_uidx
  ON catalog_pipeline_runs (status)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS catalog_pipeline_runs_started_at_idx
  ON catalog_pipeline_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS catalog_pipeline_run_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES catalog_pipeline_runs(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed')),
  records_accepted integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT catalog_pipeline_run_sources_run_source_uidx UNIQUE (run_id, source_id)
);

CREATE TABLE IF NOT EXISTS catalog_pipeline_merge_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES catalog_pipeline_runs(id) ON DELETE CASCADE,
  variety_key text NOT NULL,
  contributing_sources text[] NOT NULL,
  field_winners jsonb NOT NULL,
  CONSTRAINT catalog_pipeline_merge_decisions_run_key_uidx UNIQUE (run_id, variety_key)
);

CREATE TABLE IF NOT EXISTS catalog_plant_sources (
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  external_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_plant_sources_plant_source_uidx UNIQUE (plant_id, source_id)
);

CREATE INDEX IF NOT EXISTS catalog_plant_sources_source_id_idx
  ON catalog_plant_sources (source_id);

CREATE TABLE IF NOT EXISTS catalog_pipeline_settings (
  id integer PRIMARY KEY,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'disabled')),
  run_at_hour_utc integer NOT NULL DEFAULT 6 CHECK (run_at_hour_utc BETWEEN 0 AND 23),
  source_order text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO catalog_pipeline_settings (id, cadence, run_at_hour_utc, source_order)
VALUES (1, 'daily', 6, ARRAY['fixture']::text[])
ON CONFLICT (id) DO NOTHING;
