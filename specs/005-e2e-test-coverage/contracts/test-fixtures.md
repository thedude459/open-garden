# Test Fixtures Contract

**Feature**: 005-e2e-test-coverage

## Module: `tests/e2e/fixtures/auth.ts`

### `testEmail(): string`

Returns unique email `e2e-{random}@test.local`.

### `registerViaApi(request, { email, password }): Promise<{ userId, email }>`

| Step | Request | Expected |
|------|---------|----------|
| 1 | `POST /api/auth/register` `{ email, password }` | `201`, body `{ user: { id, email } }` |
| Duplicate | Same email twice | `409` |

Password MUST be ≥8 characters.

### `loginAs(page, { email, password }): Promise<void>`

| Step | Action | Expected |
|------|--------|----------|
| 1 | `page.goto('/login')` | Login form visible |
| 2 | Fill email, password; submit | Navigate away from `/login` |
| 3 | `page.goto('/gardens')` | Gardens list or empty state (not redirect login) |

**Constraint**: Used by all non-`auth.spec.ts` files. `auth.spec.ts` MUST NOT call
`loginAs` for happy-path register/login tests (UI only per FR-012).

### `TEST_PASSWORD`

Exported constant shared across specs (e.g. `TestPass123!`).

---

## Module: `tests/e2e/fixtures/garden.ts`

Requires authenticated `page` (call `loginAs` first).

### `createGardenViaApi(page, partial?): Promise<GardenSummary>`

| Field | Default |
|-------|---------|
| name | `E2E Garden` + suffix |
| length | 20 |
| width | 10 |
| unit | `feet` |
| zone_type | `vegetable` |

`POST /api/gardens` → returns `{ id, name, ... }`.

### `addAreaViaApi(page, gardenId, area): Promise<AreaSummary>`

`POST /api/gardens/{id}/areas` with `kind: bed | path`, geometry, optional soil/sun.

### `getPlantIdByName(page, commonName): Promise<string>`

Query catalog search API or use known seed IDs map:
`{ Tomato, Basil, Fennel, Apple }` resolved after seed.

---

## Module: `tests/e2e/fixtures/climate.ts`

Requires authenticated `page` (call `loginAs` first).

### `setTestLocationViaApi(page, { cityOrPostal }): Promise<void>`

Sets user location profile via API or UI shortcut so climate filter is active.
Default: a location in zone 5–8 compatible with seeded Tomato hardiness.

Used by `plant-catalog.spec.ts` climate filter test (T030).

---

## Module: `tests/e2e/fixtures/index.ts`

```typescript
import { test as base } from "@playwright/test";
// Optional: extend base with auto-login fixture for specs that need it
export { test, expect } from "@playwright/test";
export * from "./auth";
export * from "./garden";
export * from "./climate";
```

**Future extension**: `test.extend({ authedPage })` — defer to implementation if
per-spec `loginAs` calls suffice for v1.

---

## Global Setup Contract: `tests/e2e/global-setup.ts`

| Step | Script | Failure mode |
|------|--------|--------------|
| 1 | `tsx scripts/e2e-reset-db.ts` | Exit 1 — abort suite |
| 2 | `tsx scripts/e2e-seed-catalog.ts` (reference plants + planner assets) | Exit 1 — abort suite |

Environment: `DATABASE_URL` MUST point to test database (not production).

---

## Tagging Contract

| Tag | Meaning | CI trigger |
|-----|---------|------------|
| `@smoke` | P1/P2 critical journeys only | `npm run test:e2e:smoke` on PR |
| (untagged) | P3 and extended coverage | Full suite only |

`@smoke` is reserved for: `auth`, `garden-crud`, `layout-beds-paths`, `plant-catalog`,
`planting-validation`, `indoor-starts`. P3 specs MUST NOT use `@smoke`.

---

## Anti-Patterns (MUST NOT)

- `test.skip(true, "Requires seeded auth fixture")` after this feature ships
- Hard-coded production `DATABASE_URL`
- Shared static email `test@example.com` across parallel tests
- UI registration in every `beforeEach` outside `auth.spec.ts`
- Mobile specs calling bed/path layout editor flows
