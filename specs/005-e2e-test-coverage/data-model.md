# Data Model: End-to-End Test Coverage

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## Overview

This feature introduces **no production database schema changes**. It defines test
infrastructure entities, fixture lifecycle, and isolation rules used by Playwright
helpers and CI setup scripts.

## Test Environment

| Field | Type | Description |
|-------|------|-------------|
| database_url | `string` | Dedicated DB (`garden_e2e`); never production |
| auth_secret | `string` | NextAuth secret for test runs (`AUTH_SECRET`) |
| base_url | `string` | Default `http://localhost:3000` |
| ci_mode | `boolean` | `CI=true` → workers=1, no reuseExistingServer |

**Lifecycle**:
```text
globalSetup → e2e-reset-db (truncate + migrate)
           → e2e-seed-catalog (plants + planner assets)
           → Playwright tests run
           → (no teardown — next run resets)
```

## Test Account

| Field | Type | Description |
|-------|------|-------------|
| email | `string` | Unique per test: `e2e-{nanoid}@test.local` |
| password | `string` | Fixed test password ≥8 chars (e.g. `TestPass123!`) |
| user_id | `string` | UUID from register API response |
| session | `BrowserContext storageState` | Optional cached after `loginAs()` |

**Rules**:
- Created via `POST /api/auth/register` (all specs) or UI form (`auth.spec.ts` only)
- Never reuse emails across parallel tests within a suite (unique generation)
- DB reset between suite runs eliminates orphan accounts from failed runs

## Test Catalog Fixture

| Plant | Category | Test use |
|-------|----------|----------|
| Tomato | vegetable | Search, place, spacing footprint |
| Basil | herb | Companion browse, compatible adjacent |
| Fennel | herb | Incompatible with Tomato — hard block |
| Apple | fruit_tree | Orchard type, tree spacing metadata |

**Relationships** (from `seed-companions.ts`):
- Tomato ↔ Basil (companions)
- Tomato ↔ Fennel (incompatibles)

**Seeding**: Idempotent insert via `seedReferenceData()` after truncate.

## Test Garden

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | UUID from `POST /api/gardens` |
| name | `string` | e.g. `E2E Garden {timestamp}` |
| length | `number` | Default 20 (ft) |
| width | `number` | Default 10 (ft) |
| unit | `feet` \| `meters` | Default `feet` |
| zone_type | `vegetable` \| `orchard` \| `container` | Per growing-area spec |

**Factory**: `createGardenViaApi(page, overrides?)` after `loginAs()`.

## Test Bed / Path

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | `garden_areas.id` |
| kind | `bed` \| `path` | Plantable vs non-plantable |
| x, y | `number` | Origin inside garden (ft) |
| length, width | `number` | Area dimensions |
| soil_type | `string \| null` | Optional USDA class |
| sun_exposure | `string \| null` | Optional enum |

**Default bed for planting tests**: `{ x: 2, y: 2, length: 8, width: 6, kind: bed }`

**Default path**: `{ x: 0, y: 0, length: 20, width: 2, kind: path }` along edge

## Test Planting

| Field | Type | Description |
|-------|------|-------------|
| placement_id | `string` | After successful place |
| plant_id | `string` | Canonical plant UUID (Tomato, etc.) |
| bed_area_id | `string` | Target bed |
| position_x, position_y | `number` | Garden coordinates |
| source | `direct_seed` \| `transplant` | Planting method |

## Indoor Start (test record)

| Field | Type | Description |
|-------|------|-------------|
| start_id | `string` | Indoor start record |
| plant_id | `string` | Tomato (default) |
| target_bed_id | `string` | Linked bed; no bed occupancy until transplant |

## Journey Map Entry

| Field | Type | Description |
|-------|------|-------------|
| source_spec | `string` | e.g. `002-garden-layout` US3 |
| user_story | `string` | Story title |
| e2e_spec | `string` | File name |
| status | `covered` \| `partial` \| `excluded` | Coverage state |
| rationale | `string` | Required when `excluded` or `partial` |

## Fixture Dependency Graph

```text
globalSetup (DB + catalog)
    └── auth.spec.ts [UI only — no fixture shortcut for register/login happy paths]
    └── other specs
            ├── registerViaApi (optional if loginAs creates user)
            ├── loginAs(page) → session cookie
            ├── createGardenViaApi → garden_id
            ├── addBedViaApi / addPathViaApi → area ids
            └── UI actions under test (catalog browse, place plant, etc.)
```

## Validation Rules (test assertions)

| Scenario | Expected outcome |
|----------|------------------|
| Register invalid email | `role=alert` or 422, stay on register |
| Garden width = 0 | Save blocked, validation visible |
| Bed outside boundary | Save blocked, overlap/boundary message |
| Place Fennel adjacent Tomato | Hard block before save |
| Indoor start created | No placement on bed until transplant |
| Unauthenticated `/plants` | Redirect to `/login` |
| Mobile phone bed editor | Not invoked in mobile specs |

## State Transitions (suite level)

```text
[clean DB] --globalSetup--> [migrated + seeded]
         --test run--> [tests create users/gardens]
         --suite end--> (discarded; next run resets)
```
