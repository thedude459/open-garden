# Implementation Plan: Garden Location and Weather

**Branch**: `015-garden-location-weather` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-garden-location-weather/spec.md`

## Summary

A new garden requires a confirmed place: the gardener types an address, the server returns Nominatim candidates, and they pick one before save. Configuration (`/gardens/:id/configure`) shows that place on an OpenStreetMap iframe. No paid map key is required. Saving a place fills hardiness zone and frost dates when the climate sources know them, and replaces any hand edits. Open watering reminders stay on the list but are not required when the due day’s forecast rain is at least 2.5 mm. Unknown weather never skips watering.

Domain rules and provider ports live in a new `libs/garden-place`. Garden CRUD stays in `libs/gardens`. Rain is applied in `libs/care-reminders` as a pure step after the existing derivation. No new npm package. Tests use fixture adapters; live HTTP is off unless `PLACE_PROVIDER=live`.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST; Angular standalone PWA; Drizzle; Vitest; Playwright; existing `libs/gardens`, `libs/care-reminders`, `libs/shared-types`, `GardenMembershipGuard`. Nominatim for address lookup and an OpenStreetMap embed for the map (no API key, not a new package). Zone lookup: phzmapi.org by US ZIP. Frost lookup: FarmSense frost-date API by lat/lng (NOAA-based; failure leaves frost unset). Rain: Open-Meteo forecast `rain_sum` (no key). Nest providers that need constructor injection MUST use explicit `@Inject(...)`.

**Storage**: PostgreSQL via Drizzle migration `libs/plant-catalog-data/migrations/0010_garden_place.sql`. Nullable place columns on `gardens`. No weather table. Client IndexedDB reminder cache unchanged except it must ignore rain flags when `outlookOn` is not the device’s local date.

**Testing**: Vitest (≥80% coverage CI gate) for zone parsing, frost-pair rejection, address-change overwrite, and the 2.5 mm rain rule in `libs/garden-place` and `libs/care-reminders`. `apps/api-e2e` Zod smokes stay DB-free. Playwright (`npm run e2e`): create rejected without a place; `France` rejected as not a street site; fixture address confirms on an OpenStreetMap embed URL with no API key; configuration shows the map and not the bed layout; a failed map image does not hide a saved address; zone/frost refill on address change; watering `required: false` only at ≥2.5 mm on `dueOn`; a second garden with 0 mm rain stays required; dry, missing address, and failed outlook leave watering required; viewer sees the rain note and cannot edit; non-member 404.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose). Web calls same-origin `/api`.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + new `libs/garden-place`

**Performance Goals**: Address lookup and reminders GET stay under 2 seconds on the local network after the garden is open. Manual quickstart check only, not a CI timing gate. Rain lookup times out in 3 seconds and MUST NOT fail the reminder list.

**Constraints**: REST only. New gardens require a confirmed place (formatted address, lat, lng, place id) the gardener has seen on an OpenStreetMap map. Existing gardens may have a null place. Blank or unrecognized addresses are rejected; nothing is invented. Map is configuration and the create form only. Rain does not complete or dismiss watering. Fertilize and harvest are unchanged. Address lookup and the map require no API key.

**Scale/Scope**: Household. One place per garden. One forecast request per reminders GET. Tens of gardens per user.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Place confirmation, climate fill, and the rain rule are a public API in `libs/garden-place`. Pages and controllers stay thin.
- [x] **Provider Abstraction**: Geocoding, zone, frost, and rain go through ports. Features and `libs/gardens` / `libs/care-reminders` MUST NOT call Nominatim, OpenStreetMap, phzmapi, FarmSense, or Open-Meteo.
- [x] **Simplicity (YAGNI)**: One new lib. No Maps JavaScript SDK. No stored forecast. No extra weather tasks. Frost source failure degrades to “enter by hand” (spec FR-007).
- [x] **Multi-User**: Same owner / collaborator / viewer rules. Place and rain outcome are garden-shared. Non-members get 404.
- [x] **Type Safety & Shared Contracts**: New fields live in `libs/shared-types` only.
- [x] **REST Boundary**: Lookup, garden write, and reminders stay REST.
- [x] **Angular Standalone**: Extend the garden list and configuration pages. No NgModules.
- [x] **PostgreSQL Migrations**: `0010_garden_place.sql` only.
- [x] **Testing Gates**: Vitest on the pure rules; Playwright for create, configuration, and reminders.
- [x] **Security**: No map keys in the repo. Lookup requires a session. Address is member-only.
- [x] **Self-Hosted**: `PLACE_PROVIDER` is a Compose / `.env` setting. The map and geocoder need no paid key.
- [x] **ADR**: Flagged for `docs/adr/0016-garden-place.md` at implementation (place columns, ports, embed map, rain does not write care events).

### Post-design re-check

All gates remain satisfied. Place columns sit on `gardens` (no new data package). `GardenService` calls the climate port and still MUST NOT import Nest or vendor HTTP. Reminder derivation stays pure; `applyRainCover` only flips `required` / `rainNote`. The OpenStreetMap map is an embed URL built in the lib. No map API key is required. Fixture adapters are the CI default. Live adapters are bound only when `PLACE_PROVIDER=live`. ADR 0016 is the architecture record; this plan does not add a second membership model.

## Project Structure

### Documentation (this feature)

```text
specs/015-garden-location-weather/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rest-api.md
│   └── garden-place-ui.md
└── tasks.md                 # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
libs/garden-place/src/lib/          # ports, fixture + live adapters, pure rules
libs/gardens/src/lib/garden-service.ts
libs/care-reminders/src/lib/        # applyRainCover
libs/shared-types/src/lib/          # garden place + reminder rain fields
libs/plant-catalog-data/
├── migrations/0010_garden_place.sql
└── src/lib/garden-repository.ts
apps/api/src/gardens/               # lookup, create/patch, reminders
apps/web/src/app/gardens/
├── garden-list.page.ts             # create requires a confirmed place
├── garden-detail.page.ts           # configuration: address, map, zone, frost
└── garden-reminders.page.ts        # not-required watering
docs/adr/0016-garden-place.md       # written during implementation
```

**Structure Decision**: New `libs/garden-place` because place lookup is a different boundary from garden membership and from reminder date math. Do not add a Maps npm package. Do not put vendor HTTP in `apps/web`.

## Complexity Tracking

> No constitution violations.
