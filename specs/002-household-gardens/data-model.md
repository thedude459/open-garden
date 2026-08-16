# Data Model: Household Gardens

**Feature**: `002-household-gardens` | **Date**: 2026-08-14  
**Spec**: [spec.md](./spec.md)

## Entities

### Garden

Household planning place. Hard-deleted (no archive).

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK, generated |
| owner_id | UUID | FK → User; required; the unique owner |
| name | string | required; trimmed non-empty; max 120 chars (FR-001) |
| name_normalized | string | `lower(trim(name))`; used for uniqueness |
| notes | string \| null | max 4000 chars; empty string stored as null |
| hardiness_zone | int \| null | 1–13 inclusive when set |
| last_frost_month | int \| null | 1–12; null iff `last_frost_day` is null (month+day pair) |
| last_frost_day | int \| null | valid day for that month (Feb 29 allowed) |
| first_frost_month | int \| null | 1–12; null iff `first_frost_day` is null (month+day pair) |
| first_frost_day | int \| null | valid day for that month |
| created_at | timestamptz | required |
| updated_at | timestamptz | required; bumped on every successful update |

**Constraints**:
- UNIQUE `(owner_id, name_normalized)`
- Each frost date is a month+day pair (both columns null or both set). Last frost
  and first frost may be omitted independently.
- When both last and first frost pairs are fully set:
  `(last_frost_month, last_frost_day) < (first_frost_month, first_frost_day)`
- Same-day or reversed last/first frost pairs rejected at domain layer (and DB
  check if practical)

**Notes**:
- Unset zone or frost fields stay null; UI shows “not set”.
- Last-write-wins: later UPDATE overwrites; `updated_at` reflects last save.
- Hard DELETE removes the row; owner may reuse `name_normalized`.

### GardenMembership

Link between one user and one garden.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| garden_id | UUID | FK → Garden; ON DELETE CASCADE |
| user_id | UUID | FK → User; ON DELETE CASCADE |
| role | enum | `owner` \| `collaborator` \| `viewer` |
| created_at | timestamptz | required |

**Constraints**:
- UNIQUE `(garden_id, user_id)` — one membership per user per garden
- UNIQUE `(garden_id)` WHERE `role = 'owner'` — exactly one owner
- The owner membership’s `user_id` MUST equal `gardens.owner_id`

### User / Session (existing)

Unchanged from plant database. `users.role` remains `user` | `admin` (operator).
Garden sharing does not change account role. Invite looks up `users.email`
(lower/trim). Member list exposes `email`, `display_name`, and garden `role` to
**all** members of that garden.

### Plant / Favorite (existing)

Unchanged. Garden delete MUST NOT cascade to plants or favorites.

## Relationships

```text
User 1──* GardenMembership *──1 Garden
User 1──* Garden (as owner_id)
User 1──* Session
User 1──* Favorite *──1 Plant     -- unchanged; not garden-scoped
```

## Validation rules

- Unauthenticated: all garden routes 401.
- Non-member GET: **404** (do not leak existence). Viewer PATCH: **403**.
  Owner-only mutations by a member who is not owner: **403**.
- Non-member PATCH/DELETE: **404** (same existence policy as GET).
- Create: session user becomes owner; membership owner row inserted in the same
  transaction as the garden.
- Name uniqueness: conflict → `CONFLICT`.
- Invite unknown email → `NOT_FOUND`. Invite self → `VALIDATION_ERROR`. Invite
  existing member → `CONFLICT`. Invite role must be collaborator or viewer.
- Transfer: target must already be a member; target must not already own another
  garden with the same `name_normalized` (CONFLICT); old owner becomes
  collaborator; `gardens.owner_id` updates.
- Owner cannot leave or demote self while they are the sole owner.
- Collaborator/viewer leave: delete own membership.
- Owner remove member: delete that membership (not the owner row unless
  transfer first).
- Frost/zone validation → `VALIDATION_ERROR`; prior row unchanged.

## State transitions

### Garden

- Created → Active (only state while it exists)
- Active → Deleted (hard delete after UI confirm; no DB status)

### Membership

- Absent → collaborator | viewer (invite)
- collaborator ↔ viewer (owner PATCH)
- collaborator | viewer → owner (transfer: demote previous owner to collaborator first, then promote, in one transaction so the unique owner index holds)
- Present → Absent (leave or owner remove)

## Indexes

- UNIQUE `gardens (owner_id, name_normalized)`
- INDEX `gardens.owner_id`
- UNIQUE `garden_memberships (garden_id, user_id)`
- UNIQUE partial `garden_memberships (garden_id)` WHERE `role = 'owner'`
- INDEX `garden_memberships.user_id` (list gardens for current user)
