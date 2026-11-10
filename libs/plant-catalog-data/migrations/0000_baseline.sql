-- Baseline: the schema migrations 0001-0012 produced, squashed into one file
-- (see docs/adr/0018-baseline-migration.md). It runs only on a new database:
-- its journal timestamp equals 0012's, so databases that recorded the old
-- migrations (v0.1.0 and later) skip it. Generated with pg_dump --schema-only
-- from a database built by those migrations. Never edit it; add new files.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE TABLE public.catalog_pipeline_merge_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    variety_key text NOT NULL,
    contributing_sources text[] NOT NULL,
    field_winners jsonb NOT NULL
);

CREATE TABLE public.catalog_pipeline_run_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    source_id text NOT NULL,
    status text NOT NULL,
    records_accepted integer DEFAULT 0 NOT NULL,
    records_rejected integer DEFAULT 0 NOT NULL,
    error_message text,
    CONSTRAINT catalog_pipeline_run_sources_status_check CHECK ((status = ANY (ARRAY['succeeded'::text, 'failed'::text])))
);

CREATE TABLE public.catalog_pipeline_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    triggered_by text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    plants_upserted integer DEFAULT 0 NOT NULL,
    plants_deprecated integer DEFAULT 0 NOT NULL,
    plants_reactivated integer DEFAULT 0 NOT NULL,
    records_rejected integer DEFAULT 0 NOT NULL,
    error_message text,
    CONSTRAINT catalog_pipeline_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'incomplete'::text]))),
    CONSTRAINT catalog_pipeline_runs_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['operator'::text, 'schedule'::text])))
);

CREATE TABLE public.catalog_pipeline_settings (
    id integer NOT NULL,
    cadence text DEFAULT 'daily'::text NOT NULL,
    run_at_hour_utc integer DEFAULT 6 NOT NULL,
    source_order text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_user_id uuid,
    CONSTRAINT catalog_pipeline_settings_cadence_check CHECK ((cadence = ANY (ARRAY['daily'::text, 'disabled'::text]))),
    CONSTRAINT catalog_pipeline_settings_run_at_hour_utc_check CHECK (((run_at_hour_utc >= 0) AND (run_at_hour_utc <= 23)))
);

CREATE TABLE public.catalog_plant_sources (
    plant_id uuid NOT NULL,
    source_id text NOT NULL,
    external_id text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.catalog_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    triggered_by text NOT NULL,
    provider text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    plants_upserted integer DEFAULT 0 NOT NULL,
    error_message text
);

CREATE TABLE public.companion_pairs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    plant_id uuid NOT NULL,
    other_plant_id uuid NOT NULL,
    kind text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT companion_pairs_distinct_chk CHECK ((plant_id <> other_plant_id)),
    CONSTRAINT companion_pairs_kind_chk CHECK ((kind = ANY (ARRAY['helps'::text, 'hinders'::text, 'pollinates'::text]))),
    CONSTRAINT companion_pairs_reason_chk CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 280)))
);

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_mutation_id text
);

CREATE TABLE public.garden_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    name text NOT NULL,
    name_normalized text NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT garden_areas_kind_chk CHECK ((kind = ANY (ARRAY['vegetable'::text, 'orchard'::text, 'greenhouse'::text])))
);

CREATE TABLE public.garden_beds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    name text NOT NULL,
    name_normalized text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origin_x_inches integer,
    origin_y_inches integer,
    length_inches integer,
    width_inches integer,
    orientation smallint DEFAULT 0 NOT NULL,
    sun text,
    kind text DEFAULT 'bed'::text NOT NULL,
    area_id uuid,
    site text DEFAULT 'in_ground'::text NOT NULL,
    station text,
    mulch text DEFAULT 'none'::text NOT NULL,
    CONSTRAINT garden_beds_geometry_ck CHECK ((((origin_x_inches IS NULL) AND (origin_y_inches IS NULL) AND (length_inches IS NULL) AND (width_inches IS NULL)) OR ((origin_x_inches IS NOT NULL) AND (origin_y_inches IS NOT NULL) AND (length_inches IS NOT NULL) AND (width_inches IS NOT NULL) AND (length_inches >= 1) AND (width_inches >= 1) AND (orientation = ANY (ARRAY[0, 90, 180, 270]))))),
    CONSTRAINT garden_beds_kind_chk CHECK ((kind = ANY (ARRAY['bed'::text, 'orchard'::text]))),
    CONSTRAINT garden_beds_mulch_chk CHECK ((mulch = ANY (ARRAY['none'::text, 'wood_chips'::text, 'straw'::text, 'leaves'::text, 'compost'::text, 'paper'::text, 'plastic'::text]))),
    CONSTRAINT garden_beds_site_chk CHECK ((site = ANY (ARRAY['raised'::text, 'in_ground'::text]))),
    CONSTRAINT garden_beds_station_chk CHECK (((station IS NULL) OR (station = ANY (ARRAY['tree'::text, 'berry'::text])))),
    CONSTRAINT garden_beds_sun_chk CHECK (((sun IS NULL) OR (sun = ANY (ARRAY['full'::text, 'part'::text, 'shade'::text]))))
);

CREATE TABLE public.garden_calendar_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    plant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garden_care_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    planting_id uuid NOT NULL,
    kind text NOT NULL,
    occurrence_on date NOT NULL,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT garden_care_events_action_check CHECK ((action = ANY (ARRAY['completed'::text, 'dismissed'::text]))),
    CONSTRAINT garden_care_events_kind_check CHECK ((kind = ANY (ARRAY['water'::text, 'fertilize'::text, 'harvest'::text])))
);

CREATE TABLE public.garden_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT garden_memberships_role_chk CHECK ((role = ANY (ARRAY['owner'::text, 'collaborator'::text, 'viewer'::text])))
);

CREATE TABLE public.garden_non_planting_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    name text NOT NULL,
    name_normalized text NOT NULL,
    origin_x_inches integer NOT NULL,
    origin_y_inches integer NOT NULL,
    length_inches integer NOT NULL,
    width_inches integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT garden_non_planting_areas_length_inches_check CHECK ((length_inches >= 1)),
    CONSTRAINT garden_non_planting_areas_width_inches_check CHECK ((width_inches >= 1))
);

CREATE TABLE public.garden_planting_harvests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    planting_id uuid NOT NULL,
    harvested_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.garden_plantings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    plant_id uuid NOT NULL,
    bed_id uuid,
    planted_on date,
    harvested_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_mutation_id text,
    layout_x_inches integer,
    layout_y_inches integer,
    start_method text DEFAULT 'direct_seed'::text NOT NULL,
    indoor_started_on date,
    season_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer NOT NULL,
    life text DEFAULT 'annual'::text NOT NULL,
    note text,
    photo text,
    planted_year integer,
    rootstock text,
    years_to_fruit integer,
    spacing_feet integer,
    tray_id uuid,
    CONSTRAINT garden_plantings_layout_ck CHECK ((((layout_x_inches IS NULL) AND (layout_y_inches IS NULL)) OR ((layout_x_inches IS NOT NULL) AND (layout_y_inches IS NOT NULL)))),
    CONSTRAINT garden_plantings_life_chk CHECK ((life = ANY (ARRAY['annual'::text, 'perennial'::text, 'tree'::text]))),
    CONSTRAINT garden_plantings_note_chk CHECK (((note IS NULL) OR (char_length(note) <= 2000))),
    CONSTRAINT garden_plantings_photo_chk CHECK (((photo IS NULL) OR (char_length(photo) <= 400000))),
    CONSTRAINT garden_plantings_start_method_chk CHECK ((start_method = ANY (ARRAY['direct_seed'::text, 'transplant'::text])))
);

CREATE TABLE public.garden_seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT garden_seasons_status_chk CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))),
    CONSTRAINT garden_seasons_year_chk CHECK (((year >= 1900) AND (year <= 2500)))
);

CREATE TABLE public.garden_trays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    area_id uuid NOT NULL,
    name text NOT NULL,
    name_normalized text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.gardens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    name_normalized text NOT NULL,
    notes text,
    hardiness_zone integer,
    last_frost_month integer,
    last_frost_day integer,
    first_frost_month integer,
    first_frost_day integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    length_inches integer DEFAULT 240 NOT NULL,
    width_inches integer DEFAULT 120 NOT NULL,
    formatted_address text,
    latitude double precision,
    longitude double precision,
    place_id text,
    CONSTRAINT gardens_first_frost_pair CHECK ((((first_frost_month IS NULL) AND (first_frost_day IS NULL)) OR ((first_frost_month IS NOT NULL) AND (first_frost_day IS NOT NULL)))),
    CONSTRAINT gardens_frost_order CHECK (((last_frost_month IS NULL) OR (first_frost_month IS NULL) OR (ROW(last_frost_month, last_frost_day) < ROW(first_frost_month, first_frost_day)))),
    CONSTRAINT gardens_last_frost_pair CHECK ((((last_frost_month IS NULL) AND (last_frost_day IS NULL)) OR ((last_frost_month IS NOT NULL) AND (last_frost_day IS NOT NULL)))),
    CONSTRAINT gardens_name_len CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120))),
    CONSTRAINT gardens_notes_len CHECK (((notes IS NULL) OR (char_length(notes) <= 4000))),
    CONSTRAINT gardens_place_chk CHECK ((((formatted_address IS NULL) AND (latitude IS NULL) AND (longitude IS NULL) AND (place_id IS NULL)) OR ((formatted_address IS NOT NULL) AND ((char_length(formatted_address) >= 1) AND (char_length(formatted_address) <= 300)) AND (latitude IS NOT NULL) AND ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)) AND (longitude IS NOT NULL) AND ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)) AND (place_id IS NOT NULL) AND ((char_length(place_id) >= 1) AND (char_length(place_id) <= 300))))),
    CONSTRAINT gardens_size_chk CHECK (length_inches BETWEEN 6 AND 2400 AND width_inches BETWEEN 6 AND 2400),
    CONSTRAINT gardens_zone_chk CHECK (((hardiness_zone IS NULL) OR ((hardiness_zone >= 1) AND (hardiness_zone <= 13))))
);

CREATE TABLE public.plants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variety_key text NOT NULL,
    common_name text NOT NULL,
    species text NOT NULL,
    cultivar text,
    plant_type text NOT NULL,
    zone_min integer NOT NULL,
    zone_max integer NOT NULL,
    sun_requirements text,
    water_needs text,
    days_to_maturity integer,
    spacing_inches integer,
    provider text,
    provider_external_id text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    indoor_frost_anchor text,
    indoor_weeks_earliest integer,
    indoor_weeks_latest integer,
    sow_frost_anchor text,
    sow_weeks_earliest integer,
    sow_weeks_latest integer,
    transplant_frost_anchor text,
    transplant_weeks_earliest integer,
    transplant_weeks_latest integer,
    water_interval_days integer,
    fertilize_interval_days integer
);

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.catalog_pipeline_merge_decisions
    ADD CONSTRAINT catalog_pipeline_merge_decisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_pipeline_merge_decisions
    ADD CONSTRAINT catalog_pipeline_merge_decisions_run_key_uidx UNIQUE (run_id, variety_key);

ALTER TABLE ONLY public.catalog_pipeline_run_sources
    ADD CONSTRAINT catalog_pipeline_run_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_pipeline_run_sources
    ADD CONSTRAINT catalog_pipeline_run_sources_run_source_uidx UNIQUE (run_id, source_id);

ALTER TABLE ONLY public.catalog_pipeline_runs
    ADD CONSTRAINT catalog_pipeline_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_pipeline_settings
    ADD CONSTRAINT catalog_pipeline_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_plant_sources
    ADD CONSTRAINT catalog_plant_sources_plant_source_uidx UNIQUE (plant_id, source_id);

ALTER TABLE ONLY public.catalog_sync_runs
    ADD CONSTRAINT catalog_sync_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.companion_pairs
    ADD CONSTRAINT companion_pairs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_areas
    ADD CONSTRAINT garden_areas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_beds
    ADD CONSTRAINT garden_beds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_calendar_entries
    ADD CONSTRAINT garden_calendar_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_care_events
    ADD CONSTRAINT garden_care_events_occurrence_uidx UNIQUE (planting_id, kind, occurrence_on);

ALTER TABLE ONLY public.garden_care_events
    ADD CONSTRAINT garden_care_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_memberships
    ADD CONSTRAINT garden_memberships_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_non_planting_areas
    ADD CONSTRAINT garden_non_planting_areas_garden_name_uidx UNIQUE (garden_id, name_normalized);

ALTER TABLE ONLY public.garden_non_planting_areas
    ADD CONSTRAINT garden_non_planting_areas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_planting_harvests
    ADD CONSTRAINT garden_planting_harvests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_plantings
    ADD CONSTRAINT garden_plantings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_seasons
    ADD CONSTRAINT garden_seasons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.garden_trays
    ADD CONSTRAINT garden_trays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gardens
    ADD CONSTRAINT gardens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX catalog_pipeline_runs_one_running_uidx ON public.catalog_pipeline_runs USING btree (status) WHERE (status = 'running'::text);

CREATE INDEX catalog_pipeline_runs_started_at_idx ON public.catalog_pipeline_runs USING btree (started_at DESC);

CREATE INDEX catalog_plant_sources_source_id_idx ON public.catalog_plant_sources USING btree (source_id);

CREATE INDEX companion_pairs_garden_id_idx ON public.companion_pairs USING btree (garden_id);

CREATE UNIQUE INDEX companion_pairs_uidx ON public.companion_pairs USING btree (garden_id, plant_id, other_plant_id, kind);

CREATE UNIQUE INDEX favorites_user_plant_uidx ON public.favorites USING btree (user_id, plant_id);

CREATE INDEX garden_areas_garden_id_idx ON public.garden_areas USING btree (garden_id);

CREATE UNIQUE INDEX garden_areas_garden_name_uidx ON public.garden_areas USING btree (garden_id, name_normalized);

CREATE INDEX garden_beds_garden_id_idx ON public.garden_beds USING btree (garden_id);

CREATE UNIQUE INDEX garden_beds_garden_name_uidx ON public.garden_beds USING btree (garden_id, name_normalized);

CREATE INDEX garden_calendar_entries_garden_id_idx ON public.garden_calendar_entries USING btree (garden_id);

CREATE UNIQUE INDEX garden_calendar_entries_garden_plant_uidx ON public.garden_calendar_entries USING btree (garden_id, plant_id);

CREATE INDEX garden_care_events_planting_id_idx ON public.garden_care_events USING btree (planting_id);

CREATE UNIQUE INDEX garden_memberships_garden_user_uidx ON public.garden_memberships USING btree (garden_id, user_id);

CREATE UNIQUE INDEX garden_memberships_one_owner_uidx ON public.garden_memberships USING btree (garden_id) WHERE (role = 'owner'::text);

CREATE INDEX garden_memberships_user_id_idx ON public.garden_memberships USING btree (user_id);

CREATE INDEX garden_non_planting_areas_garden_id_idx ON public.garden_non_planting_areas USING btree (garden_id);

CREATE INDEX garden_planting_harvests_planting_id_idx ON public.garden_planting_harvests USING btree (planting_id);

CREATE UNIQUE INDEX garden_planting_harvests_uidx ON public.garden_planting_harvests USING btree (planting_id, harvested_on);

CREATE INDEX garden_plantings_bed_id_idx ON public.garden_plantings USING btree (bed_id);

CREATE INDEX garden_plantings_garden_created_idx ON public.garden_plantings USING btree (garden_id, created_at DESC);

CREATE INDEX garden_plantings_plant_id_idx ON public.garden_plantings USING btree (plant_id);

CREATE INDEX garden_plantings_tray_id_idx ON public.garden_plantings USING btree (tray_id);

CREATE UNIQUE INDEX garden_seasons_garden_year_uidx ON public.garden_seasons USING btree (garden_id, year);

CREATE UNIQUE INDEX garden_trays_area_name_uidx ON public.garden_trays USING btree (area_id, name_normalized);

CREATE INDEX garden_trays_garden_id_idx ON public.garden_trays USING btree (garden_id);

CREATE INDEX gardens_owner_id_idx ON public.gardens USING btree (owner_id);

CREATE UNIQUE INDEX gardens_owner_name_uidx ON public.gardens USING btree (owner_id, name_normalized);

CREATE INDEX plants_plant_type_idx ON public.plants USING btree (plant_type);

CREATE UNIQUE INDEX plants_variety_key_uidx ON public.plants USING btree (variety_key);

CREATE INDEX plants_zone_idx ON public.plants USING btree (zone_min, zone_max);

ALTER TABLE ONLY public.catalog_pipeline_merge_decisions
    ADD CONSTRAINT catalog_pipeline_merge_decisions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.catalog_pipeline_runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catalog_pipeline_run_sources
    ADD CONSTRAINT catalog_pipeline_run_sources_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.catalog_pipeline_runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catalog_pipeline_settings
    ADD CONSTRAINT catalog_pipeline_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.catalog_plant_sources
    ADD CONSTRAINT catalog_plant_sources_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.companion_pairs
    ADD CONSTRAINT companion_pairs_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.companion_pairs
    ADD CONSTRAINT companion_pairs_other_plant_id_fkey FOREIGN KEY (other_plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.companion_pairs
    ADD CONSTRAINT companion_pairs_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_areas
    ADD CONSTRAINT garden_areas_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_beds
    ADD CONSTRAINT garden_beds_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.garden_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_beds
    ADD CONSTRAINT garden_beds_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_calendar_entries
    ADD CONSTRAINT garden_calendar_entries_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_calendar_entries
    ADD CONSTRAINT garden_calendar_entries_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.garden_care_events
    ADD CONSTRAINT garden_care_events_planting_id_fkey FOREIGN KEY (planting_id) REFERENCES public.garden_plantings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_memberships
    ADD CONSTRAINT garden_memberships_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_memberships
    ADD CONSTRAINT garden_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_non_planting_areas
    ADD CONSTRAINT garden_non_planting_areas_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_planting_harvests
    ADD CONSTRAINT garden_planting_harvests_planting_id_fkey FOREIGN KEY (planting_id) REFERENCES public.garden_plantings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_plantings
    ADD CONSTRAINT garden_plantings_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.garden_beds(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.garden_plantings
    ADD CONSTRAINT garden_plantings_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_plantings
    ADD CONSTRAINT garden_plantings_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.garden_plantings
    ADD CONSTRAINT garden_plantings_tray_id_fkey FOREIGN KEY (tray_id) REFERENCES public.garden_trays(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.garden_seasons
    ADD CONSTRAINT garden_seasons_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_trays
    ADD CONSTRAINT garden_trays_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.garden_areas(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.garden_trays
    ADD CONSTRAINT garden_trays_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES public.gardens(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gardens
    ADD CONSTRAINT gardens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
