# Research: Household Gardens

**Feature**: `002-household-gardens` | **Date**: 2026-08-14

## 1. Domain library vs app-only folders

**Decision**: New Nx lib `libs/gardens` for garden and membership domain
services. Nest controllers in `apps/api/src/gardens/` stay thin.

**Rationale**: Constitution library-first. Garden rules (owner uniqueness, frost
ordering, exactly-one-owner, invite-by-email) are independently testable without
HTTP.

**Alternatives considered**:
- **App-only modules**: Faster to type, violates Principle I and makes authZ
  rules harder to unit-test.
- **Fold into `libs/auth`**: Mixes session login with resource sharing.

## 2. Persistence home

**Decision**: Add `gardens` and `garden_memberships` tables and repositories to
`libs/plant-catalog-data` (existing Drizzle schema + migrations). Do not create
`libs/gardens-data`. The plant-sync CLI applies every `*.sql` in
`libs/plant-catalog-data/migrations` (not only `0001`).

**Rationale**: One migration pipeline, one DB client. Users/sessions already live
there. YAGNI for a second data package at household scale.

**Alternatives considered**:
- **Dedicated data lib**: Cleaner name, extra Nx project and wiring for no gain.
- **SQLite/local-only gardens**: Breaks multi-device sharing and constitution
  PostgreSQL rule.

## 3. Membership model vs `users.role`

**Decision**: Keep `users.role` as `user` | `admin` (operator sync). Garden
access is a per-garden membership row: `owner` | `collaborator` | `viewer`.
Exactly one owner per garden, stored both as `gardens.owner_id` (for unique
name index) and a membership row with role `owner`. Transfer demotes the
current owner to collaborator **before** promoting the new owner, in one
transaction, so the partial unique index `garden_memberships_one_owner_uidx`
is never violated.

**Rationale**: Admin is a product operator; garden owner is a household role.
Conflating them would let every garden owner run plant sync.

**ADR**: `docs/adr/0004-garden-membership.md`

**Alternatives considered**:
- **Global “gardener” role only**: Cannot share one garden without sharing all.
- **Membership without `owner_id` on gardens**: Uniqueness query is a join;
  transfer is easier to get wrong. Denormalized `owner_id` + unique
  `(owner_id, name_normalized)` is simpler to enforce.

## 4. Name uniqueness

**Decision**: Persist `name_normalized = lower(trim(name))`. UNIQUE
`(owner_id, name_normalized)`. Collaborator rename is validated against the
**garden owner’s** owned names, not the collaborator’s. After hard delete, the
name is free for that owner. Comparison is case-insensitive.

**Rationale**: Matches spec clarification. Two households can both have
“Backyard”.

**Alternatives considered**: Global unique names (collides across households);
unique among all memberships (blocks joining a friend’s “Backyard”).

## 5. Frost dates storage and validation

**Decision**: Store four nullable smallints: `last_frost_month/day`,
`first_frost_month/day`. Each frost date is a month+day pair (both null or both
set; valid calendar day for that month, including leap-day Feb 29). Last frost
and first frost may be omitted independently. When **both** last and first dates
are set, require last < first by (month, day) tuple. No timezone, no year.

**Rationale**: Spec is annual month-day, northern-hemisphere ordering. Avoids
sentinel years on `date` columns.

**Alternatives considered**:
- **ISO `date` with year 2000**: Confusing in SQL and UI.
- **Day-of-year int**: Leap-day and “April 15” mapping is worse UX.
- **Require both frost dates together**: Rejected in clarify (either may be
  unset).

## 6. Delete

**Decision**: UI confirm then `DELETE` the garden row. `ON DELETE CASCADE`
memberships. No archive column, no undelete API. Last-write-wins does not apply
to delete (delete is terminal). Cached client copies become stale; after
reconnect, GET returns 404 and the client drops the detail cache.

**Rationale**: Spec: permanent delete after confirm. Cascade is correct before
plantings exist; later features that FK to gardens must use `ON DELETE CASCADE`
or restrict — out of scope here.

**Alternatives considered**: Soft-delete (filters forever); recycle bin (YAGNI).

## 7. Concurrent edits

**Decision**: Last successful UPDATE wins. No ETag/If-Match in v1. PATCH
responses return the stored garden. Clients re-read after save (response body)
and on focus/refresh. No merge UI.

**Rationale**: Spec clarification; household scale; YAGNI vs optimistic
concurrency.

**Alternatives considered**: Version column + 409 CONFLICT (more tests, little
user value for notes/zone).

## 8. Invite by email

**Decision**: Lookup `users.email` (normalized lower/trim, same as auth). If no
row → `NOT_FOUND` with a safe message (must already have an account). If already
a member → `CONFLICT`. Role on invite is `collaborator` or `viewer` only. No
SMTP, no pending-invite table.

**Rationale**: Spec: existing accounts only, immediate membership.

**Alternatives considered**: Magic-link email (out of scope); pending invites
(YAGNI).

## 9. Offline

**Decision**: IndexedDB keyed by user + garden list query / garden id
(`garden-cache.service.ts`). Read-through when GET succeeds; serve cache when
GET fails and cache exists. A 404 on detail deletes that cache entry. Mutations
check `navigator.onLine` and failed fetch (status 0 / ≥502): show
online-required; do **not** enqueue (unlike favorites). Angular **dev server has
no service worker**; Playwright offline coverage aborts `**/api/gardens**` (and
plant API for catalog) rather than `context.setOffline(true)` + full reload.

**Rationale**: Spec FR-014. Favorites queue is the wrong model for membership.

**Alternatives considered**: Background Sync for invites (rejected); service
worker only without IndexedDB (harder to merge list pages).

## 10. AuthZ enforcement

**Decision**: Session guard (existing) on all `/api/gardens*`. Additional
membership guard loads membership for `gardenId` + session user. Owner-only
routes: delete, invite, role change, remove others, transfer. Owner+collaborator:
PATCH garden fields. Any member: GET garden, GET members. Self DELETE membership
= leave (forbidden for the sole owner). Non-member GET → **404**. Viewer PATCH →
**403**.

`SessionGuard` MUST `@Inject(AuthService)`. Implicit constructor injection fails
when the API is hosted with `tsx` (no `emitDecoratorMetadata`), which made
authenticated catalog/garden GETs 500 in Playwright (`this.auth` was undefined
after the cookie was present).

**Rationale**: Never trust client-supplied owner id. Isolation tests are
acceptance-critical (SC-003, SC-013).

## 11. Notes length, pagination, and site-profile UI

**Decision**: Notes max 4000 Unicode characters. Garden list `pageSize` default
20, max 100 (same as catalog). Zone and frost month `<select>` use native
`value` strings coerced to numbers in the component — not Angular `[ngValue]`
objects — so Playwright `selectOption` and a reload persist the saved profile.

**Rationale**: Spec deferred “reasonable limit” and paging to planning; match
catalog defaults. `[ngValue]` options do not round-trip through native select
APIs used by e2e.

## 12. Same-origin API for session cookies

**Decision**: Web HttpClient uses relative `/api` with `withCredentials: true`.
Angular dev server proxies `/api` → `http://localhost:3000`. Nest sets
`og_session` `SameSite=Lax` on that origin.

**Rationale**: Chromium drops the cookie on cross-origin `:4200` → `:3000`
XHRs. Same-origin proxy is required for Playwright and local PWA auth.

**Alternatives considered**: CORS + `SameSite=None; Secure` (wrong for local
HTTP); absolute `http://localhost:3000/api` (the cookie bug).

## 13. Testing split (unit vs integration)

**Decision**: `apps/api-e2e` stays Zod/schema contract smokes in the Vitest
`npm test` job so CI unit tests do not need Postgres. Constitution integration
tests run as Playwright against Compose (`scripts/ci/e2e.sh`): UI journeys plus
HTTP request tests in `apps/web-e2e/src/garden-api.spec.ts` (session cookie via
the `/api` proxy).

**Rationale**: The unit job historically had no live API. Putting HTTP tests in
Playwright reuses the e2e stack (Postgres, seed, tsx API, proxy) instead of a
second Nest bootstrap in Vitest.

**Alternatives considered**: Live HTTP in `apps/api-e2e` during `npm test`
(requires Postgres in the unit job); skip HTTP and call Playwright UI “enough”
(misses status-code isolation).

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance | Technical gate: <2s list/detail local household load (distinct from SC-001/002 two-minute usability studies) |
| Scale | Tens of users; tens of gardens per user; page size 20; name max 120; notes max 4000 |
| Domain lib | `libs/gardens` |
| Persistence | Extend `plant-catalog-data`; sync CLI runs all `*.sql` |
| AuthZ | Membership rows + `gardens.owner_id`; `@Inject(AuthService)` |
| Offline | Read cache only; abort API routes in Playwright; after reconnect + refresh, 404 drops stale detail cache |
| Frost storage | Month+day pair per frost date (both set or both null); last and first may be omitted independently; last < first when both dates are set |
| Cookies | Relative `/api` + Angular proxy |
| Testing | Unit Vitest + Zod smokes in `npm test`; Playwright HTTP+UI vs Compose |
| Site UI | Native select `value`, not `[ngValue]` |
