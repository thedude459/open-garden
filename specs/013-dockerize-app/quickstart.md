# Quickstart: Dockerize Full Application

**Feature**: `013-dockerize-app` | **Date**: 2026-09-07

Operator proof for [spec.md](./spec.md). Commands match [contracts/compose.md](./contracts/compose.md).

## Prerequisites

- Docker Compose
- This repository
- Local testing: copy `.env.example` → `.env` (do not commit `.env`)
- NAS: ability to set container env (`POSTGRES_PASSWORD`, `SESSION_SECRET`, `WEB_HOST=0.0.0.0`) in the NAS Docker UI — not a file in git

## Local testing (`http://127.0.0.1:8080`)

```bash
cp -n .env.example .env
docker compose --profile app up -d --build
```

1. Open `http://127.0.0.1:8080` **on this machine**. Sign-in or landing loads. Address is loopback, not a LAN IP.
2. Sign in `gardener@example.com` / `password123`. Plants catalog is browsable (first boot may take a while for fixture load; later boots skip it).
3. Create a garden, `docker compose --profile app stop api web && docker compose --profile app up -d api web`, sign in again — garden still there. Postgres stayed up.
4. From another device on the LAN, `http://<laptop-ip>:8080` should **not** be required to work (bind is loopback).
5. With the stack up: `STACK_E2E=1 npx playwright test apps/web-e2e/src/stack-compose.spec.ts` (or the project’s equivalent) against `http://127.0.0.1:8080` — landing/sign-in visible. This is **not** part of `npm run e2e`.

Stop UI/API only: `docker compose --profile app stop api web`.  
Data store only (inner loop): `docker compose up -d postgres` then `npm run api:serve` and `npm run web:serve` as today (`http://localhost:4200`).

Wipe data (explicit): `docker compose --profile app down` does **not** remove `pgdata` unless you pass `-v` — do not use `-v` unless you mean to destroy gardens.

If start fails because **8080 or 5432 is already in use**, read the Docker/Compose bind error (it names the port). Stop the other process or set `WEB_PORT`.

## NAS production / LAN bind proof

1. Start **postgres** alone (`docker compose up -d postgres`) with passwords from the NAS Docker setup.
2. Start **api** and **web** (`docker compose --profile app up -d api web`) with `WEB_HOST=0.0.0.0` and the same secrets. Do not start postgres again in a way that creates a second volume.
3. **LAN proof (required for FR-016):** `curl -fsS http://<LAN-IP>:8080/api/health` must be 200 (`<LAN-IP>` is a non-loopback address of this machine, not `127.0.0.1`). Then sign in as gardener from a browser at `http://<LAN-IP>:8080` (phone or another PC, or a browser on this machine using that IP). Map host **80** → container **8080** in the NAS UI if you want port 80.
4. **SC-002 time:** start a timer when `GET /api/health` first returns 200 (after this start, excluding image pull/build). Record minutes until demo sign-in succeeds in the notes below. Must be ≤ 10.
5. Stop api+web; postgres stays. Start api+web again; gardens remain.
6. If `SESSION_SECRET` is unset, api exits and logs the missing name.

### SC-002 recorded time

| Date | Health-200 → demo sign-in | Notes |
|------|---------------------------|--------|
| 2026-09-07 | <1 minute | Exclude first image pull/build. After `GET /api/health` 200, demo sign-in (`gardener@example.com`) succeeded immediately (~0s). First-boot fixture (empty volume) finished before health 200 (~50 plants).

## What not to do

- Point the **api container** at `DATABASE_URL=...@localhost` — it must use the Compose service name `postgres`.
- Expect stacked web on `:4200` — that port stays for host `nx serve`.
- Set `NODE_ENV=production` and assume cookies work without `COOKIE_SECURE=false` (the default). HTTP NAS login fails if `Secure` cookies are on.

## Automated tests

```bash
npm test          # unit + coverage gate
npm run e2e       # host API/web + Compose postgres (not profile app)
STACK_E2E=1 npx playwright test apps/web-e2e/src/stack-compose.spec.ts --config apps/web-e2e/playwright.config.ts
```

New unit checks (cookie flags, refuse empty secret) run with `npm test`. Merge-gate e2e stays on the host path.
