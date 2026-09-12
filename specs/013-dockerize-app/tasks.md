---
description: "Task list for dockerize full application"
---

# Tasks: Dockerize Full Application

**Input**: Design documents from `/specs/013-dockerize-app/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/compose.md, quickstart.md, ADR 0015

**Tests**: Vitest for new boot/cookie helpers (constitution ≥80% on touched API code). TDD order is flexible. No product migration. No new Nx lib. Host gardener Playwright stays `npm run e2e` / `scripts/ci/e2e.sh` (postgres-only Compose). **Stacked nginx origin** is `apps/web-e2e/src/stack-compose.spec.ts` with `STACK_E2E=1` (T019) — required for feature complete, not added to the merge-gate job. LAN bind + SC-002 time are T035.

**Organization**: Tasks are grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US5]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Repo root: `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `.env.example`, `README.md`  
`apps/api/src/`, `apps/web/nginx.conf`, `apps/web-e2e/src/stack-compose.spec.ts`, `scripts/docker/`, `docs/adr/0015-docker-compose-stack.md`

---

## Phase 1: Setup

**Purpose**: Env keys and ignore rules so images and local `.env` do not fight each other

- [X] T001 Add `COOKIE_SECURE`, `WEB_HOST`, `WEB_PORT` (and comments that NAS injects secrets, `.env` is local-only) to `.env.example`. Keep existing `DATABASE_URL=...@localhost` for the host workflow
- [X] T002 Confirm `.dockerignore` excludes `node_modules`, `dist`, `.env`, `.git` (extend only if a needed path is missing)

---

## Phase 2: Foundational (API boot + images + Compose skeleton)

**Purpose**: Cookie/HTTP, health probe, wait/migrate/seed-if-empty, Dockerfiles, Compose `app` profile. **No story validation until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

### Tests (REQUIRED) ✅

- [X] T003 [P] Vitest `apps/api/src/auth/session-cookie.spec.ts`: `secure` is true only when `COOKIE_SECURE=true`; `NODE_ENV=production` alone MUST NOT set `secure`
- [X] T004 [P] Vitest `apps/api/src/boot-env.spec.ts`: missing/empty `SESSION_SECRET` or `DATABASE_URL` throws a message that names the key
- [X] T005 [P] Vitest `apps/api/src/wait-for-db.spec.ts`: retries then throws on timeout (inject a fake connect; no live Postgres required)

### Implementation

- [X] T006 Extract `sessionCookieOptions()` in `apps/api/src/auth/session-cookie.ts` (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` from `COOKIE_SECURE`). Use it from `setSessionCookie` / `clearCookie` in `apps/api/src/auth/auth.controller.ts`
- [X] T007 [P] Add no-auth `GET /api/health` → `200` in `apps/api/src/health.controller.ts` and register it on `apps/api/src/app.module.ts`
- [X] T008 Call `assertBootEnv()` from `apps/api/src/boot-env.ts` at the start of `apps/api/src/main.ts` (and the Docker entrypoint before migrate)
- [X] T009 Implement `waitForDb` in `apps/api/src/wait-for-db.ts` (retry `DATABASE_URL` until connect or timeout). Used by `scripts/docker/api-entrypoint.sh`
- [X] T010 Add `--seed-only` to `apps/api/src/plants/sync-cli.ts`: skip the SQL-file loop; still create demo users and run the fixture pipeline. When plants already exist, skip the pipeline (idempotent demo `catch` may stay). Host `nx run api:sync-plants` without the flag keeps today’s SQL+seed behavior
- [X] T011 Write `scripts/docker/api-entrypoint.sh`: `assert` env → `waitForDb` → `npm run migrate` (only schema path) → `tsx apps/api/src/plants/sync-cli.ts --seed-only` (empty catalog only via T010) → `exec tsx apps/api/src/main.ts`. MUST NOT run the SQL loop and Drizzle migrate in the same boot
- [X] T012 Write `Dockerfile.api` (Node 24, repo context, `npm ci`, `COOKIE_SECURE` default false, `NODE_ENV=production`, CMD entrypoint T011)
- [X] T013 [P] Write `apps/web/nginx.conf`: SPA `try_files` for HTML routes; `location /api/` proxy_pass `http://api:3000`; **no cache** on `/api`, `/ngsw.json`, `/ngsw-worker.js`; those SW files MUST NOT fall through to `index.html`; listen 80
- [X] T014 [P] Write `Dockerfile.web` (stage: Node 24 `npx nx build web --configuration=production`; copy `dist/web/browser` + `apps/web/nginx.conf` into `nginx:alpine`)
- [X] T015 Extend `docker-compose.yml`: keep `postgres` unprofiled with volume `pgdata` and healthcheck; publish `127.0.0.1:5432`; add `api` and `web` with profile `app`; `api` `depends_on` postgres healthy; `web` `depends_on` api healthy (`GET /api/health`); `api` **must** set `DATABASE_URL` to hostname `postgres` (ignore host `.env` localhost URL)

**Checkpoint**: `docker compose config --profile app` succeeds. Unit tests T003–T005 pass. Images can build. Stories can bind/env-document without inventing boot code.

---

## Phase 3: User Story 1 - Local Testing On Localhost (Priority: P1) 🎯 MVP

**Goal**: `docker compose --profile app up -d --build` serves the packaged app at **`http://127.0.0.1:8080`** only. Secrets from `.env`. No host Node/Postgres install for this path.

**Independent Test**: After T016–T017, open `http://127.0.0.1:8080` on the same machine — sign-in/landing loads. Curl (T018) and `STACK_E2E=1` Playwright (T019) pass. Documented address is loopback, not a LAN IP (`WEB_HOST` default `127.0.0.1`).

### Implementation for User Story 1

- [X] T016 [US1] In `docker-compose.yml`, default `WEB_HOST=127.0.0.1`, `WEB_PORT=8080`, `web` ports `${WEB_HOST:-127.0.0.1}:${WEB_PORT:-8080}:80`. `env_file: .env` on `api` **only** for `SESSION_SECRET` (and optional `POSTGRES_*`); do not let `.env` `DATABASE_URL=localhost` override T015
- [X] T017 [US1] Document local testing command and `http://127.0.0.1:8080` in `README.md` (keep host `npm run web:serve` on `:4200` in a separate subsection — full host-path proof is US5)

### Tests for User Story 1 (REQUIRED) ✅

- [X] T018 [US1] Smoke: `curl -fsS http://127.0.0.1:8080/` is 200 and `curl -fsS http://127.0.0.1:8080/api/health` is 200 after `docker compose --profile app up -d --build` (requires T015–T016). Record the commands in `specs/013-dockerize-app/quickstart.md` if they drifted
- [X] T019 [US1] Add `apps/web-e2e/src/stack-compose.spec.ts`: skip unless `STACK_E2E=1`; `baseURL` `http://127.0.0.1:8080`; assert landing or sign-in is visible (no host `:4200`). With the stack up (after T018), run it. Do **not** add this file to `scripts/ci/e2e.sh`

**Checkpoint**: MVP — stacked app on loopback. Seed/sign-in completeness is US2. LAN bind is US3.

---

## Phase 4: User Story 2 - The Running App Is Usable (Priority: P1)

**Goal**: First boot migrates and leaves demo gardener + browsable catalog. Browser `/api` is same origin (nginx). No extra host seed command.

**Independent Test**: Fresh volume, `compose --profile app up`, sign in `gardener@example.com` / `password123` at `http://127.0.0.1:8080`, open Plants. Network tab: API calls stay on `:8080/api` (no `:3000`).

### Tests for User Story 2 (REQUIRED) ✅

- [X] T020 [US2] First-boot proof on a **new** `pgdata` (disposable compose project name if needed): after api healthy, gardener login at `http://127.0.0.1:8080` and Plants list work. Do not `docker compose down -v` on the default `pgdata` in `docker-compose.yml`

### Implementation for User Story 2

- [X] T021 [US2] Confirm `apps/web/nginx.conf` proxies `/api/` including cookies (`proxy_set_header Host`, `Cookie`). SPA routes (e.g. `/login`) fall through to `index.html`. `/ngsw.json` and `/ngsw-worker.js` MUST NOT fall through to `index.html` (T013)
- [X] T022 [US2] Confirm entrypoint T011 order: migrate then T010 empty bootstrap then listen. Second `compose up` of api MUST NOT re-run the full fixture pipeline (watch api logs)

**Checkpoint**: Empty-DB start is usable; restart is fast. Host Playwright (`T034`) stays on `:4200`. Stacked origin Playwright is T019.

---

## Phase 5: User Story 3 - NAS Production (Priority: P1)

**Goal**: Postgres can run alone. UI/API start/stop separately. Gardeners open `http://<NAS-IP>:8080` (`WEB_HOST=0.0.0.0`). Secrets from NAS env, not git.

**Independent Test**: `docker compose up -d postgres`, then `--profile app up -d api web` with `WEB_HOST=0.0.0.0`. `curl http://<LAN-IP>:8080/api/health` is 200. Stop api+web; `postgres` still running and `pgdata` intact.

### Tests for User Story 3 (REQUIRED) ✅

- [X] T023 [US3] Using `docker-compose.yml`: `docker compose up -d postgres` starts only postgres. Then `WEB_HOST=0.0.0.0 docker compose --profile app up -d api web` does not create a second data volume. `curl -fsS http://<non-loopback-IP>:8080/api/health` is 200 (use this machine’s LAN IP). `docker compose --profile app stop api web` leaves postgres healthy

### Implementation for User Story 3

- [X] T024 [US3] Document NAS start order, `WEB_HOST=0.0.0.0`, `http://<NAS-IP>:8080`, and “map host 80 in the NAS UI if you want” in `README.md` and `specs/013-dockerize-app/quickstart.md`. No committed production `.env`
- [X] T025 [US3] Compose interpolates `POSTGRES_PASSWORD` / `SESSION_SECRET` from the environment (NAS Docker UI). Defaults allowed **only** for local testing (`open_garden` / `.env`), never as committed NAS production values

**Checkpoint**: Contract commands in `specs/013-dockerize-app/contracts/compose.md` match README.

---

## Phase 6: User Story 4 - Restarts Keep Data; Secrets Stay Out of the Recipe (Priority: P2)

**Goal**: Stop/start UI/API keeps gardens. Missing NAS secrets fail with a named key. Repo has no production credentials.

**Independent Test**: Create a garden on the stacked app, `stop api web` then `up api web`, garden still there. Grep the repo: no production passwords. Unset `SESSION_SECRET` → api exits naming it.

### Tests for User Story 4 (REQUIRED) ✅

- [X] T026 [US4] With stacked app up: create a garden, `docker compose --profile app stop api web && docker compose --profile app up -d api web`, sign in — garden remains (quickstart persist step)
- [X] T027 [P] [US4] Start `api` with empty `SESSION_SECRET` (override in compose) and confirm non-zero exit / log names `SESSION_SECRET`. Do not commit that override

### Implementation for User Story 4

- [X] T028 [US4] Grep `docker-compose.yml`, `Dockerfile.*`, `.env.example` for hardcoded production secrets. Local defaults in `.env.example` must be labeled non-production. `down -v` / volume wipe documented as **explicit** only in `README.md` and `specs/013-dockerize-app/quickstart.md`

**Checkpoint**: Persist + fail-closed secrets. Cookie HTTP behavior already in T003/T006.

---

## Phase 7: User Story 5 - Native Local Workflow Still Works (Priority: P3)

**Goal**: `docker compose up -d postgres` + `npm run api:serve` + `npm run web:serve` still works. Host `.env` `DATABASE_URL=localhost:5432`. API container port not stealing `:3000`.

**Independent Test**: Postgres-only, host API+web, sign in at `http://localhost:4200`. With full profile `app` up, host tools can still reach `127.0.0.1:5432`.

### Tests for User Story 5 (REQUIRED) ✅

- [X] T029 [US5] `docker compose up -d postgres` then `npm run api:serve` / `npm run web:serve` — login at `:4200` works (existing proxy). `docker compose --profile app config` shows **no** host publish of `api:3000`

### Implementation for User Story 5

- [X] T030 [US5] README “Quick start” keeps the host commands. Add a clearly labeled **stacked** subsection (US1) so a new contributor can tell the two paths apart (`specs/013-dockerize-app/contracts/compose.md` table)

**Checkpoint**: Inner-loop unchanged. Existing `npm run e2e` still uses postgres-only Compose (do not point `scripts/ci/e2e.sh` at profile `app`).

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Docs, coverage, security pass, full quickstart

- [X] T031 [P] Align `README.md`, `specs/013-dockerize-app/quickstart.md`, and `specs/013-dockerize-app/contracts/compose.md` (commands, ports, wipe vs stop)
- [X] T032 [P] Confirm `docs/adr/0015-docker-compose-stack.md` still matches the implemented Compose/cookie/env split; amend if implement drifted
- [X] T033 Run `npm test` — coverage gate still ≥80% on product libs; new `apps/api` helpers have Vitest (T003–T005)
- [X] T034 Run `npm run e2e` once (host path) to confirm 012 job still green after cookie/health changes
- [X] T035 Walk `specs/013-dockerize-app/quickstart.md` local testing section end to end (including persist and T019). Then `WEB_HOST=0.0.0.0 docker compose --profile app up -d api web`, `curl -fsS http://<LAN-IP>:8080/api/health` (non-loopback). Record health-200 → demo sign-in minutes in the SC-002 table in that quickstart (≤10, exclude first image pull/build). Note Docker bind errors for port-in-use; do not write a custom parser

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 stack actually serving (nginx + entrypoint already in Phase 2; this phase is first-boot proof)
- **US3 (Phase 5)**: Depends on Foundational; can overlap US2 if staffed (different docs vs first-boot)
- **US4 (Phase 6)**: Depends on US2 (need a usable app to persist a garden)
- **US5 (Phase 7)**: Depends on Foundational compose not breaking postgres-only; can run after US1
- **Polish (Phase 8)**: After stories you intend to ship (all of them for this feature)

### User Story Dependencies

- **US1**: After Phase 2 — T016 then T017, then T018 curl, then T019 Playwright (stack must be up)
- **US2**: After US1 smokes (T018–T019) so origin exists
- **US3**: After Phase 2; T023 LAN curl after web is bound `0.0.0.0`
- **US4**: After US2 (data to persist)
- **US5**: After Phase 2 postgres publish/loopback is set

### Parallel Opportunities

- T003, T004, T005 together
- T007, T013, T014 together (after cookie/health design is clear)
- T024 vs T023 after T015
- T031, T032 in polish

---

## Parallel Example: Foundational

```bash
# After T006 cookie helper exists:
Task: "T003 session-cookie.spec.ts"
Task: "T004 boot-env.spec.ts"
Task: "T005 wait-for-db.spec.ts"

# Images (after nginx contract is known):
Task: "T013 apps/web/nginx.conf"
Task: "T014 Dockerfile.web"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2
2. Phase 3 (US1) — stacked localhost origin
3. **STOP**: curl `:8080/` and `/api/health` (T018); `STACK_E2E=1` Playwright (T019)

### Incremental Delivery

1. US1 → localhost stack
2. US2 → first-boot usable (sign-in, catalog)
3. US3 → NAS bind + DB-alone commands
4. US4 → persist + secret failure
5. US5 → host workflow still works
6. Polish → README/ADR/coverage/e2e/quickstart

---

## Notes

- [P] = different files, no wait on an incomplete sibling
- Do not add an Nx project for Dockerfiles
- Do not switch `scripts/ci/e2e.sh` onto `--profile app`
- Do not document `docker compose down -v` as normal stop
- `DATABASE_URL` in the **api container** is always hostname `postgres`
- Container boot: Drizzle migrate **xor** unflagged `sync-cli` SQL — never both (`--seed-only` after migrate)
