# Data model: Dockerize Full Application

**Feature**: `013-dockerize-app` | **Date**: 2026-09-07

No new PostgreSQL tables or columns. Product entities (users, gardens, memberships, plantings, catalog, sessions) are unchanged. This feature defines **runtime** entities for the stacked run.

## Run mode

How the operator starts and where gardeners open the app.

| Field | Rules |
|-------|--------|
| Local testing | Web origin `http://127.0.0.1:8080` (or documented `WEB_PORT`). Secrets from `.env`. Bind `WEB_HOST=127.0.0.1`. |
| NAS production | Web origin `http://<NAS-IP>:8080` (NAS may map host 80). Secrets from NAS Docker env. Bind `WEB_HOST=0.0.0.0`. Data store may already be running. |

Same images and Compose file. Mode is bind address + secret source, not a second codebase.

## Compose service

| Service | Identity | Persist | Start grouping |
|---------|----------|---------|----------------|
| `postgres` | Own container | Volume `pgdata` | Always; startable **alone** |
| `api` | Own container | Stateless (uses postgres) | Profile `app`; start/stop **without** removing `pgdata` |
| `web` | Own container | Stateless (static + proxy) | Profile `app`; same lifecycle as `api` |

**Forbidden**: bundling postgres into the api image; `docker compose down -v` as the documented “stop”; wiping `pgdata` on UI/API restart.

## Operator configuration

| Key | Local testing | NAS production | Empty |
|-----|---------------|----------------|-------|
| `DATABASE_URL` | Host workflow: `localhost:5432`. Api **container** overrides to `postgres:5432` | Injected / derived from NAS postgres credentials | API must not start |
| `SESSION_SECRET` | `.env` | NAS Docker setup | API must not start |
| `POSTGRES_USER` / `PASSWORD` / `DB` | Defaults `open_garden` / from `.env` | NAS Docker setup | Postgres must not start with empty password |
| `COOKIE_SECURE` | default `false` | default `false` (HTTP). Set `true` only with TLS (out of scope) | treat as false |
| `WEB_HOST` | default `127.0.0.1` | `0.0.0.0` | default `127.0.0.1` |
| `WEB_PORT` | default `8080` | default `8080` | default 8080 |
| `PLANT_PROVIDER` | `fixture` | `fixture` unless operator sets otherwise | fixture |

Committed `.env.example` documents **keys**, not NAS production values.

## Bootstrap state (empty vs existing)

On API **container** start: Drizzle `migrate` first (only schema path). Then:

| Catalog / demo users | Action |
|----------------------|--------|
| Empty (no plants or missing demo gardener/admin) | `sync-cli --seed-only` (demo accounts + fixture pipeline; **no** SQL files) |
| Already populated | Skip seed; serve |

Host `npm run api:sync-plants` still applies SQL + seed (unchanged).

**Forbidden**: deleting gardener rows to “fix” schema; running a full fixture pipeline on every restart; running `sync-cli` SQL apply **and** `npm run migrate` in the same container boot.

## Session cookie (stacked HTTP)

| Flag | Value |
|------|--------|
| `httpOnly` | true |
| `sameSite` | `lax` |
| `path` | `/` |
| `secure` | `COOKIE_SECURE === 'true'` only — **not** implied by `NODE_ENV=production` |

Cookie is issued for the **web origin** (nginx same host). Host `:4200` workflow unchanged (`CORS_ORIGIN` for that path only).
