# CI Pipeline Contract

**Feature**: 005-e2e-test-coverage

## Workflow: `.github/workflows/e2e.yml`

### Triggers

| Event | Job | Command |
|-------|-----|---------|
| `pull_request` | `e2e-smoke` | `npm run test:e2e:smoke` |
| `push` to `main` | `e2e-full` | `npm run test:e2e:full` |
| `schedule` cron `0 6 * * *` | `e2e-full` | `npm run test:e2e:full` |

### Services

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: garden_e2e
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/garden_e2e` | Yes |
| `AUTH_SECRET` | GitHub secret `AUTH_SECRET` or CI fallback | Yes |
| `CI` | `true` | Set by Actions |
| `NODE_ENV` | `test` | Recommended |

### Job Steps (ordered)

1. Checkout
2. Setup Node 20
3. `npm ci`
4. `npm run db:migrate` (with test `DATABASE_URL`)
5. `npx playwright install --with-deps chromium`
6. `npm run test:e2e:smoke` OR `npm run test:e2e:full`
7. Upload `playwright-report/` + `test-results/` on failure (artifact)

**Failure artifacts**: trace zip on first retry; screenshot on failure (Playwright default).

### Success Criteria Mapping

| Criterion | Enforcement |
|-----------|-------------|
| FR-014 | Workflow exists; PR + main/nightly paths |
| FR-017 | `trace: on-first-retry` and `screenshot: only-on-failure` in config; artifacts on fail |
| FR-018 | `globalSetup` reset before tests in step 6 |
| SC-003 | Smoke job timeout 10 min; full job timeout 20 min |

### npm Scripts (package.json)

```json
{
  "e2e:reset": "tsx scripts/e2e-reset-db.ts && tsx scripts/e2e-seed-catalog.ts",
  "test:e2e": "playwright test",
  "test:e2e:smoke": "playwright test --grep @smoke",
  "test:e2e:full": "playwright test"
}
```

### Local Parity

Developers use Docker Compose (same Postgres as dev, separate `garden_e2e` database):

```bash
export DATABASE_URL=postgres://garden:garden@localhost:5432/garden_e2e
export AUTH_SECRET=local-e2e-auth-secret-min-32-chars!!
npm run e2e:prepare   # e2e:db:ensure + e2e:reset
npm run test:e2e:smoke
```

`e2e:db:ensure` runs `docker compose up -d postgres --wait` and creates `garden_e2e`
if missing. CI uses GitHub Actions `services:` instead — no Docker Compose in CI.
