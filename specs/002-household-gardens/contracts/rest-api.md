# Household Gardens API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax) required on all garden
routes. The PWA calls relative `/api` (dev proxy to Nest) so the cookie is
first-party. `SessionGuard` uses `@Inject(AuthService)` (tsx does not emit
constructor param types).  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth; this file is the human contract)

Error shape and pagination match [001 rest-api](../../001-plant-database/contracts/rest-api.md):
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

Non-members requesting a garden by id receive **404** (no existence leak).

---

## Types

### GardenRole

`owner` | `collaborator` | `viewer`

### MonthDay

```json
{ "month": 4, "day": 15 }
```

`month` 1–12; `day` valid for that month (29 allowed for February).

### MemberDto

```json
{
  "userId": "uuid",
  "email": "gardener@example.com",
  "displayName": "Ada",
  "role": "collaborator"
}
```

Visible to every member of the garden.

### GardenSummaryDto

```json
{
  "id": "uuid",
  "name": "Backyard",
  "hardinessZone": 7,
  "myRole": "owner"
}
```

`hardinessZone` may be `null`.

### GardenDetailDto

```json
{
  "id": "uuid",
  "name": "Backyard",
  "notes": "South fence gets afternoon shade.",
  "hardinessZone": 7,
  "lastFrost": { "month": 4, "day": 15 },
  "firstFrost": { "month": 10, "day": 20 },
  "myRole": "owner",
  "ownerUserId": "uuid",
  "members": [],
  "updatedAt": "2026-08-13T18:00:00.000Z"
}
```

`notes`, `hardinessZone`, `lastFrost`, `firstFrost` may be `null`. `members`
is the full member list (name, email, role) for any caller who is a member.

---

## GET /api/gardens

List gardens the current user belongs to.

**Query**: `page`, `pageSize` (default 20, max 100)

**Response**: `PageDto<GardenSummaryDto>`

---

## POST /api/gardens

Create a garden. Caller becomes owner.

**Body**:

```json
{
  "name": "Backyard",
  "notes": null,
  "hardinessZone": 7,
  "lastFrost": { "month": 4, "day": 15 },
  "firstFrost": { "month": 10, "day": 20 }
}
```

Site fields optional. Name required.

**Response**: `201` + `GardenDetailDto`  
**Errors**: `VALIDATION_ERROR`, `CONFLICT` (owned name taken)

---

## GET /api/gardens/:id

**Response**: `GardenDetailDto`  
**Errors**: `404` if missing or not a member

---

## PATCH /api/gardens/:id

Owner or collaborator. Last successful save wins; response is stored garden.

**Body** (all fields optional; omitted = unchanged; JSON `null` clears nullable
fields):

```json
{
  "name": "Front yard",
  "notes": null,
  "hardinessZone": 6,
  "lastFrost": { "month": 5, "day": 1 },
  "firstFrost": null
}
```

**Response**: `GardenDetailDto`  
**Errors**: `404`, `FORBIDDEN` (viewer), `VALIDATION_ERROR` (frost order, zone),
`CONFLICT` (owned name)

---

## DELETE /api/gardens/:id

Owner only. Permanent. UI must confirm before calling.

**Response**: `204`  
**Errors**: `404`, `FORBIDDEN`

---

## GET /api/gardens/:id/members

Any member. Same data as `GardenDetailDto.members`.

**Response**: `{ "members": MemberDto[] }`

---

## POST /api/gardens/:id/members

Owner only. Immediate membership.

**Body**:

```json
{ "email": "other@example.com", "role": "collaborator" }
```

`role`: `collaborator` | `viewer` only.

**Response**: `201` + `MemberDto`  
**Errors**: `NOT_FOUND` (no account), `CONFLICT` (already member),
`VALIDATION_ERROR` (self-invite, invalid role), `FORBIDDEN`

---

## PATCH /api/gardens/:id/members/:userId

Owner only.

**Body** (one of):

```json
{ "role": "viewer" }
```

```json
{ "role": "owner" }
```

Setting `role` to `owner` **transfers** ownership: target must already be a
member; previous owner becomes `collaborator`; `gardens.owner_id` updates.
Cannot demote the last owner except via transfer.

**Response**: `MemberDto` (the target after change)  
**Errors**: `CONFLICT` (new owner already owns same normalized name),
`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`

---

## DELETE /api/gardens/:id/members/:userId

- Owner removing someone else: allowed (not themselves unless already transferred).
- Caller removing self: leave (collaborator/viewer only).

**Response**: `204`  
**Errors**: `FORBIDDEN` (owner leaving; viewer/collaborator removing others),
`NOT_FOUND`

---

## Unchanged catalog / favorites

`GET /api/plants*`, `GET/PUT/DELETE /api/favorites*` stay as in 001. Garden
membership MUST NOT change those authorization rules.
