# Research: Dockerize Full Application

**Feature**: `013-dockerize-app` | **Date**: 2026-09-07

## 1. Same origin (pages + API)

**Decision**: Stacked **web** is an nginx image that serves the Angular **production** build and reverse-proxies `/api` to the **api** container. The browser uses relative `/api` (already how every `apps/web` HTTP client is written). No second public URL. No CORS for the stacked path.

Local testing origin: `http://127.0.0.1:8080` (bind `127.0.0.1`).  
NAS production origin: `http://<NAS-IP>:8080` (bind `0.0.0.0`; operator may remap host 80→8080 in the NAS UI).

**Rationale**: Clarify forbade a second API URL. Baking a host/IP into the SPA would break NAS IP changes. nginx in the web image is one extra process, not a fourth Compose *product* or a new Nx app. Host `nx serve web` on `:4200` with `proxy.conf.json` is unchanged (User Story 5).

**Alternatives considered**:

- Nest serves `dist/web` from the API container — one fewer image, but UI and API cannot start/stop as separate containers (FR-015 / “run separately”).
- Two published ports + `CORS_ORIGIN` — rejected in clarify.
- Caddy/Traefik as a third image — extra moving part; nginx in the web image is enough.

## 2. Compose topology (profiles)

**Decision**: One `docker-compose.yml` in the repo root:

| Service | Image | Profile | Host ports (default) |
|---------|-------|---------|----------------------|
| `postgres` | `postgres:16-alpine` (existing) | none (always) | `127.0.0.1:5432` |
| `api` | build `Dockerfile.api` | `app` | not published |
| `web` | build `Dockerfile.web` | `app` | `${WEB_HOST:-127.0.0.1}:${WEB_PORT:-8080}:80` |

Commands:

- Data store only (today’s workflow): `docker compose up -d postgres`
- Local testing full stack: `docker compose --profile app up -d --build`
- NAS: start `postgres` first; then `docker compose --profile app up -d api web` with NAS-injected env and `WEB_HOST=0.0.0.0`

`api` `depends_on` postgres **healthy**. `web` `depends_on` api **healthy** (HTTP check on `/api/plants` or a tiny `/api/health` if plants auth-gates the probe — prefer a no-auth `/api/health` returning 200 so nginx and Compose do not need a session).

**Rationale**: FR-013/015 (DB alone, UI/API without wiping DB). Profile keeps `docker compose up -d postgres` working (FR-011). Binding postgres to loopback still satisfies FR-014 (host API on the same machine) without advertising Postgres on the LAN.

**Alternatives considered**:

- Two Compose files (`compose.yml` + `compose.nas.yml`) — extra file for bind/env the NAS UI already overrides.
- Publish API `:3000` — not needed for same-origin; collides with host `nx serve api`.
- Kubernetes / Swarm — out of spec.

## 3. API image and first boot

**Decision**: `Dockerfile.api` from **Node 24** (CI pin), repo as build context, `npm ci`, run with existing `tsx` (API `build` target is typecheck-only today — do not invent a Nest webpack emit for this feature).

Entrypoint:

1. Refuse empty `DATABASE_URL` or `SESSION_SECRET`.
2. Retry Postgres until connect (or timeout) — FR-009. Compose healthcheck is not enough across NAS start order.
3. `npm run migrate` (existing Drizzle) — **the only** schema-apply path on container boot.
4. Bootstrap **if empty**: `tsx apps/api/src/plants/sync-cli.ts --seed-only` (demo users + fixture pipeline; **does not** re-apply SQL files). Skip when plants already exist so every restart is not a full catalog load.
5. `tsx apps/api/src/main.ts`.

Host `npm run api:sync-plants` keeps today’s behavior (SQL files + seed) for contributors without Compose.

`DATABASE_URL` **inside** Compose **must** use hostname `postgres`, not the host `.env` `localhost` value. Set it in the `api` service `environment:` block so `.env` used for host workflow does not break the container.

**Rationale**: FR-005/006 without a second seed tool. One migrate path (Drizzle) plus optional seed. Do not run `sync-cli`’s raw SQL loop after `npm run migrate`.

**Alternatives considered**:

- Compile API to JS — needs a new Nx emit target; YAGNI while `tsx` already runs production-like in e2e.
- Seed every start — too slow; would re-run fixture pipeline.
- Operator still runs `api:sync-plants` on the host — fails FR-006.

## 4. Web image

**Decision**: Multi-stage: Node 24 `npx nx build web --configuration=production`, copy the browser output (Angular application builder: `dist/web/browser`) into `nginx:alpine` with a config that:

- `try_files` for the SPA **except** service-worker files
- `location /api/` proxy_pass to `http://api:3000`
- do **not** cache `/api`, `/ngsw.json`, or `/ngsw-worker.js`
- listen 80 inside the container

**Rationale**: FR-003 packaged web, not live-reload. Same class of build as 012 production serve.

**Alternatives considered**: `npx serve` / `nx serve --configuration=production` in a Node container — heavier and still needs a proxy.

## 5. Secrets and cookies (HTTP NAS)

**Decision**:

- Local testing: Compose `env_file: .env` for `SESSION_SECRET` (and optional `POSTGRES_*`). Documented example stays `.env.example`. Postgres password default `open_garden` for local only.
- NAS: **no** committed production `.env`. Operator sets `POSTGRES_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL` (or equivalent pieces) in the NAS Docker UI. Compose `${VAR}` substitution. Missing required vars → container exits with a named error.
- Session cookie: today `secure: NODE_ENV === 'production'`. Stacked API will set `NODE_ENV=production`, which would drop cookies on **HTTP**. Use `COOKIE_SECURE` (default `false` for this HTTP self-host). `sameSite: 'lax'`, `httpOnly`, `path: '/'` stay. Extract a tiny helper + Vitest so the default cannot regress.

`SESSION_SECRET` is in `.env.example` but unused in code (sessions are DB hashed tokens, ADR 0002). Still **require** it at API boot so NAS operators set it and we fail closed (FR-008). Do not invent HMAC cookie signing in this feature.

**Rationale**: Clarify: `.env` locally, NAS Docker setup in production. TLS out of scope.

**Alternatives considered**:

- Keep `secure` tied to `NODE_ENV` — breaks NAS HTTP login.
- Generate secrets on first start — rejected; operator supplies them.

## 6. Localhost vs NAS bind

**Decision**: `WEB_HOST` / `WEB_PORT` Compose variables. Default `127.0.0.1:8080` (local testing). NAS sets `WEB_HOST=0.0.0.0`. Do not default stacked web to `:4200` (host `nx serve` keeps 4200) or privileged `:80` (NAS UI can map 80).

**Rationale**: US1 vs US3. One Compose file.

## 7. Testing and CI

**Decision**: CI e2e job **stays** on host `tsx` + production `nx serve` + Compose **postgres only** (spec assumption). This feature adds:

- Vitest for cookie-option helper and empty-secret / wait-timeout behavior.
- One Playwright spec `apps/web-e2e/src/stack-compose.spec.ts` run with `STACK_E2E=1` against `http://127.0.0.1:8080` during implement (constitution E2E for nginx origin). **Not** wired into `scripts/ci/e2e.sh`.
- Quickstart: curl local origin; `WEB_HOST=0.0.0.0` + health on a non-loopback address; record minutes from health-200 to demo sign-in (SC-002).

**Rationale**: Merge-gate path may stay. The stacked origin is a different server than `:4200` proxy, so host Playwright alone does not cover nginx.

**Alternatives considered**: Switch CI onto `--profile app` — out of scope; larger e2e rewrite. Docs-only compose proof — rejected (constitution E2E + FR-016).

## 8. Docs and ADR

**Decision**: README + this feature `quickstart.md` list both modes. ADR **0015** for Compose profiles, same-origin nginx, HTTP cookies, env split.

**Rationale**: Constitution: significant deploy decisions get an ADR. FR-010.
