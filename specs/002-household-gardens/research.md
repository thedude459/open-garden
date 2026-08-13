# Research: Household Gardens

**Feature**: `002-household-gardens` | **Date**: 2026-08-13

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
`libs/gardens-data`.

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
name index) and a membership row with role `owner`.

**Rationale**: Admin is a product operator; garden owner is a household role.
Conflating them would let every garden owner run plant sync.

**ADR**: `docs/adr/0004-garden-membership.md` (author at implement).

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

**Rationale**: Matches spec clarification B. Two households can both have
“Backyard”.

**Alternatives considered**: Global unique names (collides across households);
unique among all memberships (blocks joining a friend’s “Backyard”).

## 5. Frost dates storage and validation

**Decision**: Store four nullable smallints: `last_frost_month/day`,
`first_frost_month/day`. A pair is either both null or both set (valid calendar
day for that month, including leap-day Feb 29 as allowed annual value). When
**both** last and first pairs are set, require last < first by (month, day)
tuple. Independent omission of one pair remains allowed. No timezone, no year.

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
reconnect, GET returns 404/NOT_FOUND and the list omits the garden.

**Rationale**: Clarify A. Cascade is correct before plantings exist; later
features that FK to gardens must use `ON DELETE CASCADE` or restrict — out of
scope here.

**Alternatives considered**: Soft-delete (filters forever); recycle bin (YAGNI).

## 7. Concurrent edits

**Decision**: Last successful UPDATE wins. No ETag/If-Match in v1. PATCH/PUT
responses return the stored garden. Clients re-read after save (response body)
and on focus/refresh. No merge UI.

**Rationale**: Clarify B; household scale; YAGNI vs optimistic concurrency.

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

**Decision**: Reuse the catalog-cache pattern: IndexedDB (or Cache API) keyed by
user + garden list query / garden id. Read-through when GET succeeds; serve
cache when GET fails and cache exists. Mutations check `navigator.onLine` (and
failed fetch): show online-required; do **not** enqueue (unlike favorites).

**Rationale**: Spec FR-014. Favorites queue is the wrong model for membership.

**Alternatives considered**: Background Sync for invites (rejected); service
worker only without IndexedDB (harder to merge list pages).

## 10. AuthZ enforcement

**Decision**: Session guard (existing) on all `/api/gardens*`. Additional
membership guard loads membership for `gardenId` + session user. Owner-only
routes: delete, invite, role change, remove others, transfer. Owner+collaborator:
PATCH garden fields. Any member: GET garden, GET members. Self DELETE membership
= leave (forbidden for the sole owner).

**Rationale**: Never trust client-supplied owner id. Isolation tests are
acceptance-critical (SC-003, SC-013).

## 11. Notes length and pagination

**Decision**: Notes max 4000 Unicode characters. Garden list `pageSize` default
20, max 100 (same as catalog).

**Rationale**: Spec deferred “reasonable limit” and paging to planning; match
catalog defaults.

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance | <2s list/detail local household load |
| Scale | Tens of users; tens of gardens per user; page size 20 |
| Domain lib | `libs/gardens` |
| Persistence | Extend `plant-catalog-data` |
| AuthZ | Membership rows + `gardens.owner_id` |
| Offline | Read cache only |
| Frost storage | Month/day smallints + last < first when both set |
