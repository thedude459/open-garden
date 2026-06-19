# Contract: Auth & User API

**Version**: 1.0

## Authentication

Auth.js Credentials provider. Session via HTTP-only cookie.

### POST `/api/auth/register`

**Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response 201**: `{ "user": { "id": "uuid", "email": "..." } }`

**Errors**: `409` email exists; `422` validation failure

### Sign-in

Use Auth.js built-in `/api/auth/signin` with credentials provider.

**Middleware**: All `/plants/*` routes and `/api/plants/*` require session.

Unauthenticated access → redirect to `/login`.

## GET `/api/users/me/location`

**Response 200**:

```json
{
  "city_or_postal": "97201",
  "usda_zone": 8,
  "last_frost_date": "2026-04-15",
  "first_frost_date": "2026-11-01"
}
```

**Response 404**: No location saved

## PUT `/api/users/me/location`

Set location (FR-010a). Called when user first enables climate filter.

**Body**:

```json
{
  "city_or_postal": "97201"
}
```

**Response 200**: Resolved location object (same as GET)

Server geocodes input, resolves USDA zone and frost dates, persists to
`user_locations`.

## Provisional Plants

### GET `/api/users/me/provisionals`

List user's provisional plants.

### POST `/api/users/me/provisionals`

**Body** (minimum fields):

```json
{
  "common_name": "Custom Tomato",
  "plant_category": "vegetable",
  "spacing_cm": { "row": 90, "plant": 45 },
  "days_to_maturity": 75,
  "optional_fields": {}
}
```

**Response 201**: Provisional plant object with `provenance: "provisional"`

### GET `/api/users/me/provisionals/:id`

Detail view for provisional plant.

### POST `/api/users/me/provisionals/:id/link`

User confirms linking to canonical match (FR-014a).

**Body**:

```json
{
  "canonical_plant_id": "uuid",
  "confirm": true
}
```

**Response 200**: Merged plant detail with `provenance: "linked_provisional"`

Field merge rules: authoritative fills gaps; user values retained where
authoritative field is null.

**Response 409**: No pending link offer for this provisional

## Link Offer Notifications

After sync, server sets `link_status = link_offered` on matching provisionals.
Client polls or receives on next `/api/users/me/provisionals` load.

Match criteria: normalized common name similarity + same `plant_category`.
