# Journey Map: End-to-End Coverage

**Feature**: 005-e2e-test-coverage | **FR-015 / SC-005**

Maps user stories from product specs 001–004 to E2E spec files. Status updated
during implementation.

## Legend

| Status | Meaning |
|--------|---------|
| **covered** | At least one automated passing test |
| **partial** | One path tested; not all acceptance scenarios |
| **excluded** | Intentionally out of scope with rationale |

---

## 001 — Plant Database

| Story | Priority | E2E spec | Status | Notes |
|-------|----------|----------|--------|-------|
| US1 Search & browse catalog | P1 | `plant-catalog.spec.ts` | partial | Seeded catalog only; no live sync |
| US2 Plant detail | P2 | `plant-catalog.spec.ts` | partial | Key fields visible |
| US3 Climate filter | P3 | `plant-catalog.spec.ts` | covered | `@smoke` with test location fixture (T030) |
| US4 Provisional plants | P4 | — | excluded | Device-local provisional flow; unit tests suffice |
| Unauthenticated redirect | — | `auth.spec.ts` | covered | Consolidated in auth spec (T017) |

---

## 002 — Garden Layout & Planting

| Story | Priority | E2E spec | Status | Notes |
|-------|----------|----------|--------|-------|
| US1 Create garden | P1 | `garden-crud.spec.ts` | covered | Create, list, open |
| US2 Beds & paths | P2 | `layout-beds-paths.spec.ts` | covered | Bed + path + validation |
| US3 Place plants | P3 | `planting-validation.spec.ts` | covered | Spacing + incompatible |
| US4 Edit layout | P4 | `layout-beds-paths.spec.ts` | partial | Add areas; move/resize deferred |
| US5 Indoor / direct seed | P5 | `indoor-starts.spec.ts` | covered | Both flows |
| US6 Rotation & geometry | P6 | — | partial | One advisory rotation smoke optional |
| Invalid garden dimensions | — | `garden-crud.spec.ts` | covered | FR-005 |

---

## 003 — Visual Planner UI

| Story | Priority | E2E spec | Status | Notes |
|-------|----------|----------|--------|-------|
| US1 Illustrated planning | P1 | `visual-planner.spec.ts`, `planting-interaction.spec.ts` | covered | Illustration + click/drag place |
| US2 Growing-area types | P2 | `growing-area-types.spec.ts` | covered | Types + orchard Apple spacing (T040) |
| US3 Structures library | P3 | — | excluded | Structures v1 shallow; unit tests |
| US4 Templates | P4 | — | excluded | Template picker not smoke-critical |
| US5 Planner chrome | P5 | `accessibility-contrast.spec.ts`, `visual-planner.spec.ts` | covered | Contrast + toolbar zoom (T042) |
| Legacy garden upgrade | — | `visual-planner-upgrade.spec.ts` | covered | Opens in planner |

---

## 004 — Drag-Drop UX

| Story | Priority | E2E spec | Status | Notes |
|-------|----------|----------|--------|-------|
| US1 Drag-and-drop planting | P1 | `planting-interaction.spec.ts` | covered | Desktop drag + auto-save |
| US2 Design system | P2 | `accessibility-contrast.spec.ts` | covered | Login + planner primary contrast |
| US3 Guidance & feedback | P3 | `planting-interaction.spec.ts` | covered | Toast on success; invalid blocked in planting-validation |
| Mobile click-to-place | — | `mobile-click-place.spec.ts` | covered | Phone viewport only |
| Canvas bed/path draw | deferred | — | excluded | Per 004 spec deferral |

---

## 005 — Auth & Infrastructure (this feature)

| Story | Priority | E2E spec | Status | Notes |
|-------|----------|----------|--------|-------|
| US1 Account register/login | P1 | `auth.spec.ts` | covered | Full UI |
| US7 Test infrastructure | P1 | all `@smoke` | covered | No permanent skips |
| Protected route redirects | — | `auth.spec.ts` | covered | FR-003; `/plants` redirect consolidated |

---

## Coverage Targets (from spec)

| Target | Metric |
|--------|--------|
| SC-001 | 100% P1 rows **covered** |
| SC-002 | ≥90% P2 rows **covered** or **partial** with documented gap |
| SC-005 | This table maintained; **excluded** rows have rationale |

## Excluded (global, all specs)

| Capability | Rationale |
|------------|-----------|
| Offline IndexedDB catalog | Spec assumption — online flow sufficient |
| Password reset / email verify | Not implemented in product |
| Load / penetration testing | Out of scope |
| Pixel visual regression | Out of scope |
| Exhaustive soil/sun permutations | Out of scope |
