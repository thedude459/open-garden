# Garden Place and Rain API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`). `SessionGuard` uses `@Inject(AuthService)`. Garden routes keep `GardenMembershipGuard`.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth)

Error shape matches [002 rest-api](../../002-household-gardens/contracts/rest-api.md). Non-members get **404** `Garden not found`.

## Place messages

| Code | When | Message |
|------|------|---------|
| `VALIDATION_ERROR` | Create without `place` | `A garden address is required` |
| `VALIDATION_ERROR` | Blank lookup query | `A garden address is required` |
| `VALIDATION_ERROR` | Lookup finds nothing | `That address could not be found` |
| `VALIDATION_ERROR` | Place fields incomplete, out of range, or address longer than 300 characters | `A confirmed garden address is required` |
| `VALIDATION_ERROR` | Every match is only a country, region, or city | `Type a street address. A city, region, or country is not a garden site.` |
| `SERVICE_UNAVAILABLE` | Live geocoding cannot run (Nominatim error or timeout) | `Place lookup is unavailable. Try again when you are online.` |
| `FORBIDDEN` | Viewer PATCH place, zone, or frost | `Viewers cannot update this garden` |
| `NOT_FOUND` | Missing garden or non-member | `Garden not found` |

`SERVICE_UNAVAILABLE` is HTTP 503. Body still uses the shared error shape with `code: "SERVICE_UNAVAILABLE"`.

---

## Types

### PlaceCandidateDto

```ts
interface PlaceCandidateDto {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  postalCode: string | null;
  countryCode: string | null;
}
```

### PlaceLookupDto

```ts
interface PlaceLookupDto {
  candidates: PlaceCandidateDto[];
  truncated: boolean;
}
```

`truncated` is true when more than 5 street-level matches remain. The array length is then 5.

The garden map is an OpenStreetMap embed. Its URL carries the place coordinates and no API key. There is no map-key request, and saving a place is not gated on one.

### Garden place on detail

`GardenDetailDto` and the create/patch body add:

```ts
place: PlaceCandidateDto | null; // detail: stored place, postalCode and countryCode null
```

Create body: `place` is required (`PlaceCandidateDto`).  
Patch body: `place` optional. When present, it replaces the stored place and refills zone and frost. When omitted, place columns stay as stored.

Write responses (`POST /api/gardens`, `PATCH /api/gardens/:id`) are `GardenDetailDto` plus:

```ts
seasonNotice: string | null;
```

GET detail does not include `seasonNotice`.

Notice strings (exact):

- `Growing zone and frost dates were updated from this address.`
- `This place was saved. Enter the growing zone and frost dates that could not be determined.`

### ReminderItemDto (extended)

```ts
required: boolean;
rainNote: string | null;
```

### ReminderListDto (extended)

```ts
outlookOn: string | null; // YYYY-MM-DD
```

Exact rain note: `Rain expected — you don't need to water.`

---

## POST /api/places/lookup

**Auth**: any signed-in user (a garden does not exist yet on create).

**Body**: `{ "query": string }` (trimmed, 1–300 characters).

**200**: `PlaceLookupDto`  
**400**: blank query, or zero matches  
**503**: live geocoder unavailable  

Does not write a garden.

## POST /api/gardens

Existing body plus required `place`. Server fills zone and frost from the climate port and ignores zone and frost in the body. **201** returns detail plus `seasonNotice`.

## PATCH /api/gardens/:id

When `place` is present: replace place columns, refill zone and frost, ignore zone and frost in the same body, return `seasonNotice`.  
When `place` is absent: today’s name/notes/zone/frost behavior, `seasonNotice` null.

Viewer: **403**. Non-member: **404**.

## GET /api/gardens/:id/reminders

Existing query `asOf`. Each item includes `required` and `rainNote`. The list includes `outlookOn`.

Water `required: false` only when a forecast day equal to `dueOn` has `rain_sum` ≥ 2.5. Any failure to read the forecast, a garden with no place, or a `dueOn` the forecast does not cover: water stays `required: true`, `rainNote` null, `outlookOn` null, HTTP 200.

Fertilize and harvest: `required: true`, `rainNote` null.

Complete and dismiss routes are unchanged and MUST NOT set `required`.

## Fixture lookup (CI and local default)

`PLACE_PROVIDER=fixture`:

| Query | Result |
|-------|--------|
| `1600 Pennsylvania Avenue NW, Washington, DC` | One street-level candidate, US ZIP `20500`, zone `8`, frost dates that pass the order check. This coordinate’s fixture rain is 5 mm on `asOf` |
| `100 Main Street` | Two street-level candidates, `truncated: false`. Their coordinates are not the Washington point, so fixture rain is 0 mm |
| `France` | 400 `Type a street address. A city, region, or country is not a garden site.` |
| `Nowhere` | 400 `That address could not be found` |

Rain fixture: the Washington candidate’s coordinates return 5 mm on `asOf` and 0 mm on every other date in the fixture forecast. Every other saved place, including both `100 Main Street` candidates, returns 0 mm on every date. The map embed needs no API key. A geocoder failure is HTTP 503, not a missing key.
