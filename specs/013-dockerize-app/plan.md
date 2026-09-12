# Implementation Plan: Dockerize Full Application

**Branch**: `013-dockerize-app` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-dockerize-app/spec.md`

## Summary

Run Open Garden from **in-repo Compose**: PostgreSQL stays a standalone service; **api** and **web** are additional containers behind the `app` profile. Stacked gardeners get **one origin** (nginx serves the Angular production build and proxies `/api`). **Local testing** binds that origin to localhost (`127.0.0.1:8080`) and reads `.env`. **NAS production** binds `0.0.0.0`, injects secrets from the NAS Docker UI, and can start/stop UI+API without stopping Postgres. Host `nx serve` + `docker compose up postgres` stays.

Technical approach: `Dockerfile.api` / `Dockerfile.web`, Compose profiles, API entrypoint (wait → migrate → seed-if-empty → listen), `COOKIE_SECURE` default false for HTTP. ADR [0015](../../docs/adr/0015-docker-compose-stack.md). No schema migration. CI e2e path unchanged.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed); Node **24** images (same major as CI)

**Primary Dependencies**: existing Nx apps (`api`, `web`); Docker Compose; nginx (web image only); `tsx` to run the API (current serve path). No new npm runtime library.

**Storage**: PostgreSQL 16 (existing Compose service + `pgdata` volume). **No new migration.** Boot runs existing Drizzle migrate + existing fixture/demo bootstrap when the catalog is empty.

**Testing**: Vitest for new API boot/cookie helpers; constitution ≥80% on product libs unchanged. Host Playwright / live `api-e2e` stay on `scripts/ci/e2e.sh` (postgres-only Compose). **Stacked origin** gets one Playwright spec gated by `STACK_E2E=1` against `http://127.0.0.1:8080` (constitution E2E for this serve path; not added to the merge-gate job). Operator proof remains [quickstart.md](./quickstart.md) including a `WEB_HOST=0.0.0.0` health check and SC-002 elapsed time.

**Target Platform**: Self-hosted Compose (laptop localhost + NAS HTTP on LAN). TLS/custom domain out of scope.

**Project Type**: Nx monorepo — **no new app/lib**. Infra files at repo root + `scripts/docker/`.

**Performance Goals**: SC-002 — gardener can sign in at the NAS IP within 10 minutes after a successful start (excluding first image pull/build). Later starts skip fixture pipeline.

**Constraints**: REST only; relative `/api` same origin; no committed production secrets; postgres startable alone; UI/API stop must not delete `pgdata`; cookie `Secure` must not break HTTP; `DATABASE_URL` in the api container uses hostname `postgres`

**Scale/Scope**: One Compose file, two Dockerfiles, README/quickstart, ADR 0015, small API boot helpers. Out of scope: k8s, CI-on-full-stack, TLS, combining UI into the API process, changing gardener UX.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: No new domain lib. This is deploy infrastructure (Compose + images), not a plant/garden capability. A `@open-garden/docker` lib would be organizational-only packaging. Entry helpers live next to `apps/api` (same as today’s `sync-cli.ts`).
- [x] **Provider Abstraction**: Fixture catalog via existing `sync-cli` / pipeline; no new provider calls.
- [x] **Simplicity (YAGNI)**: One Compose file + profiles; nginx only inside the web image; no Traefik/k8s; no Nest static merge; CI e2e not rewritten.
- [x] **Multi-User**: Unchanged product auth/sharing. Demo gardener/admin still seeded on empty DB. Session cookies must work on HTTP NAS (`COOKIE_SECURE`).
- [x] **Type Safety & Shared Contracts**: New TS helpers strict; no new DTOs; no `any`.
- [x] **REST Boundary**: No new gardener API except optional no-auth `GET /api/health` for Compose/nginx probes (not a new protocol).
- [x] **Angular Standalone**: No new UI. Production build only.
- [x] **PostgreSQL Migrations**: None new; boot runs existing migrate.
- [x] **Testing Gates**: Vitest on new boot/cookie logic; existing host Playwright in `npm run e2e` (T034); **one** Playwright smoke against the stacked origin (`STACK_E2E=1`, `:8080`, T019) so the nginx path is not docs-only; Compose LAN bind proved with `WEB_HOST=0.0.0.0` health check. CI job is not rewritten onto profile `app`.
- [x] **Security**: Fail on empty `SESSION_SECRET` / `DATABASE_URL`; production secrets from NAS env not git; postgres published on loopback; no well-known production passwords committed.
- [x] **Self-Hosted**: Compose + Dockerfiles in-repo (constitution).
- [x] **ADR**: [0015-docker-compose-stack.md](../../docs/adr/0015-docker-compose-stack.md)

## Project Structure

### Documentation (this feature)

```text
specs/013-dockerize-app/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── compose.md       # Operator stack contract
└── tasks.md             # Phase 2 (/speckit-tasks) — not created here
```

### Source Code (repository root)

```text
docker-compose.yml                 # postgres + profile app: api, web
Dockerfile.api
Dockerfile.web
apps/web/nginx.conf                # SPA + /api proxy (copied into web image)
scripts/docker/api-entrypoint.sh   # wait, migrate, seed-only if empty, exec API
apps/web-e2e/src/stack-compose.spec.ts  # STACK_E2E=1; origin :8080
apps/api/src/
├── health.controller.ts           # GET /api/health (no auth)
├── boot-env.ts
├── wait-for-db.ts
└── auth/session-cookie.ts         # cookie flags; COOKIE_SECURE
.env.example                       # keys for local .env (not NAS source)
README.md                          # both run modes
docs/adr/0015-docker-compose-stack.md
.cursor/rules/specify-rules.mdc    # point at this plan
```

**Structure Decision**: Keep infra at repo root (Compose already lives there). Do not add an Nx project for Dockerfiles. Web nginx config sits with `apps/web` because it is how that app is served in the image.

## Complexity Tracking

> No constitution violations.
