# Compose stack contract

**Feature**: `013-dockerize-app`

Operator-facing interface for running Open Garden in containers. Product REST shapes are unchanged (existing feature contracts). Browser clients keep calling **relative** `/api`.

## Services

| Name | Public to gardeners | Public to host tools | Health |
|------|---------------------|----------------------|--------|
| `postgres` | No | Yes — `127.0.0.1:5432` | `pg_isready` (existing) |
| `api` | No (reached via web `/api`) | No published port | `GET /api/health` → `200` with no session |
| `web` | Yes — documented origin | Same | nginx listens; `/api/health` proxied |

Profiles: `postgres` has **no** profile. `api` and `web` use profile **`app`**.

## Commands (normative)

| Intent | Command |
|--------|---------|
| Data store only | `docker compose up -d postgres` |
| Local testing (all three) | `docker compose --profile app up -d --build` |
| NAS / local: UI+API while DB already up | `docker compose --profile app up -d api web` |
| Stop UI+API, keep DB | `docker compose --profile app stop api web` (or `stop` those services). **Must not** delete `pgdata`. |
| Wipe stored data | Explicit documented volume remove — never implied by `stop` |

Local testing web URL after start: `http://127.0.0.1:8080` (unless `WEB_PORT` overridden).  
NAS: `http://<NAS-IP>:8080` with `WEB_HOST=0.0.0.0`.

## Environment

See [data-model.md](../data-model.md) Operator configuration. Compose **must**:

- Interpolate NAS-injected variables (no committed production `.env` required to start on NAS).
- Override `DATABASE_URL` for the `api` service to the `postgres` hostname even if the project `.env` says `localhost`.
- `env_file: .env` is allowed for **local testing** only.

Fail start (non-zero, message names the key) when `SESSION_SECRET` or `DATABASE_URL` is missing/empty on `api`, or `POSTGRES_PASSWORD` is empty on `postgres` in NAS mode.

## HTTP (same origin)

```
GET  /                 → Angular production app (SPA fallback)
GET  /api/health       → 200, no cookie
*    /api/*            → proxied to api:3000 (prefix `/api` unchanged)
```

nginx MUST NOT cache `/api`, `/ngsw.json`, or `/ngsw-worker.js`. SPA `try_files` MUST NOT replace those files with `index.html`. Session cookie `og_session` is `HttpOnly`, `SameSite=Lax`, `Secure` only if `COOKIE_SECURE=true`.

Port already bound: Compose/Docker prints the bind error (names the port). That is the operator-facing message.

## Host workflow (unchanged)

`docker compose up -d postgres` then `npm run api:serve` / `npm run web:serve`. Web `http://localhost:4200`, API `http://localhost:3000`, proxy `/api` as today. `DATABASE_URL` in `.env` stays `localhost:5432`.

## Out of contract

TLS, custom hostnames, publishing `api:3000` on the host, switching CI e2e onto profile `app`.
