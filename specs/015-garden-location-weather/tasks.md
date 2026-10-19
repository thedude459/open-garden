---
description: "Task list for garden location and weather"
---

# Tasks: Garden Location and Weather

**Input**: Design documents from `/specs/015-garden-location-weather/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, contracts/garden-place-ui.md, quickstart.md

**Tests**: REQUIRED (constitution Principle II and plan.md). Vitest for place lookup, climate rules, and the 2.5 mm rain rule. Playwright for create, configuration, and reminders. `npm test` then `npm run e2e`. Live Nominatim, phzmapi, FarmSense, and Open-Meteo are not called in CI (`PLACE_PROVIDER=fixture`).

**Already in the tree**: Checked tasks match the current spec (confirmed place, climate fill, rain cover). Unchecked tasks replace the Google Maps lookup and embed with Nominatim and an OpenStreetMap iframe. Do not add a Maps npm package or a map API key.

**Organization**: Tasks are grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US3]`) — setup, foundational, and polish omit it
- Include exact file paths in descriptions

## Path Conventions

`libs/garden-place/`, `libs/gardens/`, `libs/care-reminders/`, `libs/shared-types/`, `libs/plant-catalog-data/`, `apps/api/src/gardens/`, `apps/web/src/app/gardens/`, `apps/web-e2e/src/`, `apps/api-e2e/src/`, `docs/adr/0016-garden-place.md`

---

## Phase 1: Setup

**Purpose**: Lib shell, ADR, and operator env so story work has a place to land

- [X] T001 Add Nx lib `libs/garden-place` (`project.json` test/lint targets copied from `libs/care-reminders/project.json`, `libs/garden-place/src/index.ts`) and path `@open-garden/garden-place` → `libs/garden-place/src/index.ts` in `tsconfig.base.json`. Do not add a Maps npm package
- [X] T002 [P] Write `docs/adr/0016-garden-place.md`: place columns on `gardens`, ports for geocode/climate/rain, OpenStreetMap embed (no Maps npm package, no map API key), rain never writes `garden_care_events`, FarmSense failure leaves frost unset
- [X] T003 [P] Set `PLACE_PROVIDER=fixture` in `.env.example` and the `api` service `environment` in `docker-compose.yml`. Do not list a map API key. Comment that live uses Nominatim and OpenStreetMap plus phzmapi, FarmSense, and Open-Meteo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Place can be stored and typed. The map URL has no API key.

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T004 Add nullable `formatted_address`, `latitude`, `longitude`, and `place_id` on `gardens` in `libs/plant-catalog-data/migrations/0010_garden_place.sql` and `libs/plant-catalog-data/src/lib/schema.ts`. All four null or all four set. Address length 1–300 when set. Latitude −90..90. Longitude −180..180. Existing rows stay all-null. Thread the columns through `createOwned`, `update`, and detail reads in `libs/plant-catalog-data/src/lib/garden-repository.ts`
- [X] T005 [P] Add `PlaceCandidateDto`, `PlaceLookupDto`, and `place` on `GardenDetailDto` / create / patch in `libs/shared-types/src/lib/garden.ts` and zod in `libs/shared-types/src/lib/garden.schemas.ts`. Add write-only `seasonNotice: string | null` on the create/patch response type. Create requires `place`. Patch `place` is optional
- [X] T006 Change `embedMapUrl` in `libs/garden-place/src/lib/embed-map.ts` to `(latitude: number, longitude: number)` and export it from `libs/garden-place/src/index.ts`. Return `https://www.openstreetmap.org/export/embed.html?bbox={west},{south},{east},{north}&layer=mapnik&marker={latitude},{longitude}` with each edge 0.005 degrees from the point (`west = longitude - 0.005`, and the same pad for south, east, and north). Use literal commas. Do not take an API key

**Checkpoint**: A garden row can store a place or leave it null. The embed URL is OpenStreetMap and needs no key.

---

## Phase 3: User Story 1 - Record the Garden Address and See It on a Map (Priority: P1) 🎯 MVP

**Goal**: Create requires a confirmed place. The gardener picks a Nominatim candidate and sees it on an OpenStreetMap map, with no paid API key. Configuration shows the same place. Older gardens with no place still open.

**Independent Test**: Look up `1600 Pennsylvania Avenue NW, Washington, DC` and see one OpenStreetMap embed URL with no API key. Look up `Nowhere` and get `That address could not be found` with no garden created. Look up `France` and get `Type a street address. A city, region, or country is not a garden site.` Look up `100 Main Street` and choose between two street-level candidates. A garden with a null place still opens and shows “No address is set”. A viewer can see the address and map and cannot change them. A non-member gets `Garden not found` and does not see the address. Overview’s bed plan has no place map.

### Tests for User Story 1

- [X] T007 [P] [US1] Vitest in `libs/garden-place/src/lib/place-lookup.spec.ts` for `FixturePlaceLookup`: `1600 Pennsylvania Avenue NW, Washington, DC` returns one street-level candidate (US ZIP `20500`); `100 Main Street` returns two street-level candidates and `truncated: false`; `France` is rejected with `Type a street address. A city, region, or country is not a garden site.`; `Nowhere` is not found
- [X] T008 [P] [US1] Vitest in `libs/gardens/src/lib/garden-service.spec.ts`: create without `place` throws `A garden address is required`; create with a place stores it; patch replaces it; a garden with a null place still loads; viewer patch of `place` is refused with `Viewers cannot update this garden`
- [X] T009 [P] [US1] Extend `libs/garden-place/src/lib/place-lookup.spec.ts`: `embedMapUrl(latitude, longitude)` contains `openstreetmap.org/export/embed.html`, `layer=mapnik`, the marker coordinates, and a bbox 0.005 degrees around the point, and does not contain `key=` or `google`. Add `NominatimPlaceLookup` cases with an injected fetch (do not call Nominatim): a house number is kept; a city-only result is dropped; only city/region/country results return `Type a street address. A city, region, or country is not a garden site.`; zero results return `That address could not be found`; a non-OK response returns `Place lookup is unavailable. Try again when you are online.`; more than five street-level results set `truncated: true` and return five. `placeId` is `{osm_type}/{osm_id}`

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement `FixturePlaceLookup` in `libs/garden-place/src/lib/fixture-place-lookup.ts` for the queries in T007 (Washington `placeId` stable, postal code `20500`, country `US`; both `100 Main Street` candidates use coordinates other than Washington)
- [X] T011 [US1] Require `place` on create and accept optional `place` on patch in `libs/gardens/src/lib/garden-service.ts` and `apps/api/src/gardens/gardens.controller.ts`. Persist via T004. Reject incomplete coordinates or an address over 300 characters with `A confirmed garden address is required`. In `apps/api/src/gardens/places.controller.ts`, reject a blank or whitespace `POST /api/places/lookup` query with `A garden address is required` before schema parse
- [X] T012 [P] [US1] Add the Washington fixture `place` body in `apps/api-e2e/src/fixture-place.ts` and send it on every existing `POST /api/gardens` create in `apps/api-e2e/src/` and the web-e2e load specs that create a garden (`apps/web-e2e/src/garden-list-load.spec.ts`, `apps/web-e2e/src/planner-load.spec.ts`, `apps/web-e2e/src/plant-search-load.spec.ts`)
- [X] T013 [P] [US1] Implement `NominatimPlaceLookup` in `libs/garden-place/src/lib/nominatim-place-lookup.ts` and export it from `libs/garden-place/src/index.ts`. `GET https://nominatim.openstreetmap.org/search` with `format=jsonv2`, `addressdetails=1`, `limit=10`, and `q` set to the query. Send header `User-Agent: OpenGarden/1.0 (garden place lookup)` (hardcoded, not an env var). Keep a result when `address.house_number` is non-empty or `addresstype` is `house` or `building`. Drop the rest. If none remain, return `Type a street address. A city, region, or country is not a garden site.` Map `display_name`, `lat`, `lon`, `address.postcode`, and uppercased `address.country_code` onto `PlaceCandidateDto`. `placeId` is `{osm_type}/{osm_id}`. If more than five street-level results remain, set `truncated: true` and return the first five. A full Nominatim page that still leaves five or fewer street-level results is not truncated. Zero raw results → `That address could not be found`. Throw or non-OK → `Place lookup is unavailable. Try again when you are online.` Delete `libs/garden-place/src/lib/google-place-lookup.ts` and stop exporting `GooglePlaceLookup`
- [X] T014 [US1] In `apps/api/src/gardens/places.controller.ts`, bind `PLACE_PROVIDER=live` to `NominatimPlaceLookup` and any other value to `FixturePlaceLookup`. Remove `GET /api/places/map-key`. Keep session auth and the blank-query message from T011. A live failure returns the unavailable message, not fixture pins. Register the controller in `apps/api/src/gardens/gardens.module.ts`. Use explicit `@Inject` where Nest injects (depends on T013)
- [X] T015 [P] [US1] Delete `MapKeyDto` from `libs/shared-types/src/lib/garden.ts` and remove the `GET /api/places/map-key` client in `apps/web/src/app/gardens/gardens-api.service.ts`. Saving a place is not gated on a map key
- [X] T016 [US1] On `apps/web/src/app/gardens/garden-list.page.ts`, look up the address before create, auto-select one candidate, and require a click when there are two or more. When `truncated` is true, show `Type a more specific address.` and keep **Create garden** disabled. Show the iframe from `embedMapUrl(latitude, longitude)` (class `garden-map`, title `Garden map`) with no API key. Keep **Create garden** disabled until that iframe loads or when no candidate is selected. A missing map key is not a reason to disable create. If the iframe fails, the map region says `The map is unavailable.` Show API `error.message` for not-found, city/region/country, and unavailable. Offline: say the gardener must be online; do not queue. After 201, stay on the gardens list and show `seasonNotice` when it is non-null (depends on T006, T015)
- [X] T017 [US1] On `apps/web/src/app/gardens/garden-detail.page.ts` (configuration), show the stored address and the same OpenStreetMap embed, or `No address is set` and no pin. If the iframe fails, still show the saved address, zone, and frost, say `The map is unavailable.`, and do not block zone or frost edits. Owner and collaborator replace the address with the same lookup flow as T016, including the truncated hint. Offline address replacement says the gardener must be online and does not queue. Viewer can read address, map, zone, and frost, and cannot edit them. Do not add this map to `apps/web/src/app/gardens/garden-layout.page.ts` (depends on T006, T015)
- [X] T018 [US1] Update `apps/web-e2e/src/session.ts` to fulfill `openstreetmap.org/export/embed` with 200 HTML so the iframe `load` event fires, and stop routing `google.com/maps/embed`. Update `apps/web-e2e/src/garden-place.spec.ts` and `apps/web-e2e/src/garden-list.spec.ts`: Washington iframe `src` matches `openstreetmap.org/export/embed.html` and the coordinates and does not contain `key=`; `Nowhere` does not create; `France` shows the street-address message and does not create; `100 Main Street` requires a choice; a failed embed says `The map is unavailable.` and leaves **Create garden** disabled; null-place garden still opens; viewer can see the address and map and cannot edit address, zone, or frost; a signed-in non-member gets `Garden not found` and does not see the address; bed layout has no `openstreetmap.org/export/embed` iframe. Do not call `GET /api/places/map-key` (depends on T016, T017)

**Checkpoint**: Confirmed address and OpenStreetMap on create and configuration, with no paid map key. Climate fill and rain already behave as in Phases 4 and 5.

---

## Phase 4: User Story 2 - Fill Growing Zone and Frost Dates from the Address (Priority: P2)

**Goal**: Saving a place refills zone and frost from the climate port and tells the gardener. A hand edit sticks until the address changes. Unknown season facts stay unset.

**Independent Test**: Save the Washington fixture place and see zone `8` plus a valid frost pair and `Growing zone and frost dates were updated from this address.` Change zone without changing the address and see the edit kept. Save a place whose climate result is empty and see the hand-entry notice with zone and frost unset. No guessed dates.

### Tests for User Story 2

- [X] T019 [P] [US2] Vitest in `libs/garden-place/src/lib/climate-rules.spec.ts`: `8a` → `8`, `10b` → `10`, values outside 1–13 → null; a reversed or same-day frost pair becomes both dates null; a valid spring-then-fall pair is kept
- [X] T020 [P] [US2] Vitest in `libs/gardens/src/lib/garden-service.spec.ts`: saving a new place overwrites a hand-edited zone and frost; patching zone without `place` keeps the place and the edit; a climate miss returns `This place was saved. Enter the growing zone and frost dates that could not be determined.` and leaves those fields null

### Implementation for User Story 2

- [X] T021 [P] [US2] Implement `FixtureClimateLookup` and `LiveClimateLookup` in `libs/garden-place/src/lib/climate.ts`. Fixture: Washington ZIP `20500` → zone `8` and a last-frost-before-first-frost pair; one other fixture coordinate → all null. Live: US ZIP via `https://phzmapi.org/{zip}.json` (404 or non-US → zone null); frost via FarmSense stations + 32°F `prob_50` (season 1 spring last frost, season 2 fall first frost). Any frost failure or invalid pair stores neither frost date. Do not fail the place save
- [X] T022 [US2] On place create/patch, call the climate port from `libs/gardens/src/lib/garden-service.ts` and ignore client zone/frost in that same body. Set `seasonNotice` to `Growing zone and frost dates were updated from this address.` only when zone and both frost dates were filled; otherwise the hand-entry sentence from T020. Wire `PLACE_PROVIDER` in `apps/api/src/gardens/gardens.controller.ts` (fixture unless `live`)
- [X] T023 [US2] Show `seasonNotice` and the refilled zone and frost on `apps/web/src/app/gardens/garden-detail.page.ts` after a place save. Saving zone or frost without a new address must not clear the place or show that notice
- [X] T024 [US2] Extend `apps/web-e2e/src/garden-place.spec.ts`: Washington fill, hand-edited zone kept when the address is unchanged, empty-climate place keeps the map and shows the hand-entry notice. Scope the season sentence to `getByRole('main')`

**Checkpoint**: Address save fills or clears season facts. User Story 1’s map still works when climate returns nothing.

---

## Phase 5: User Story 3 - Watering Is Not Needed When Rain Is Expected (Priority: P3)

**Goal**: An open watering row stays visible and is not required when that `dueOn` has at least 2.5 mm of forecast rain. It is not marked done. A dry day, a missing place, or a failed forecast leaves watering required. Fertilize and harvest do not change.

**Independent Test**: Washington place, fixture forecast 5 mm on `asOf`: watering shows `Rain expected — you don't need to water.` and is not styled overdue; complete still works. A saved `100 Main Street` garden on that same day stays required. Another `asOf` with 0 mm: watering required and no note. A garden with no place, and a failed rain port, still return reminders with watering required. A viewer sees the rain note. A non-member does not.

### Tests for User Story 3

- [X] T025 [P] [US3] Vitest in `libs/care-reminders/src/lib/rain-cover.spec.ts`: water `required: false` and note `Rain expected — you don't need to water.` only when that `dueOn` is ≥ 2.5 mm; 2.4 mm, a different day, and a missing day stay required with `rainNote` null; fertilize and harvest stay required; the row is not removed; sort order is unchanged
- [X] T026 [P] [US3] Add `required` and `rainNote` on `ReminderItemDto`, and `outlookOn` on `ReminderListDto`, in `libs/shared-types/src/lib/reminders.ts`

### Implementation for User Story 3

- [X] T027 [US3] Implement `applyRainCover` in `libs/care-reminders/src/lib/rain-cover.ts` and export it from `libs/care-reminders/src/index.ts`. Do not write care events. Do not change `libs/care-reminders/src/lib/derive.ts` cadence rules
- [X] T028 [P] [US3] Add `FixtureRainOutlook` and `OpenMeteoRainOutlook` in `libs/garden-place/src/lib/fixture-rain-outlook.ts` and `libs/garden-place/src/lib/open-meteo-rain-outlook.ts`. Fixture: Washington coordinates are 5 mm on the requested `asOf` and 0 mm on other dates. Both `100 Main Street` coordinates are 0 mm on every date. Live: `daily=rain_sum`, `timezone=auto`, `forecast_days=16`, timeout 3 seconds. Use `rain_sum` millimeters, not `precipitation_sum`
- [X] T029 [US3] After derive, apply T027 in `apps/api/src/gardens/garden-reminders.controller.ts`. No place, timeout, or thrown forecast: HTTP 200, every water `required: true`, `rainNote` null, `outlookOn` null. Success: `outlookOn` equals query `asOf`. Complete and dismiss routes stay unchanged
- [X] T030 [US3] In `apps/web/src/app/gardens/garden-reminders.page.ts`, show `rainNote` and do not style `required: false` water rows as overdue. Owner and collaborator can still mark them done. If cached `outlookOn` in `apps/web/src/app/gardens/garden-reminders-cache.service.ts` is not the device’s local date, show every water row as required and hide `rainNote`
- [X] T031 [US3] Extend `apps/web-e2e/src/garden-place.spec.ts`: Washington 5 mm day is not required; the same `asOf` on a saved `100 Main Street` garden stays required; 0 mm day and a no-place garden stay required; fertilize/harvest unchanged; complete still clears the row; a viewer sees `Rain expected — you don't need to water.` and cannot mark it done; a non-member gets `Garden not found` for reminders and does not see the rain note

**Checkpoint**: Rain changes only whether watering is required. User Stories 1 and 2 still behave if the forecast is down.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Drop the leftover map key, and confirm the fixture quickstart still passes

- [X] T032 [P] Update `apps/web-e2e/src/garden-site.spec.ts` so a hand-edited zone on configuration is saved without sending a new `place` and without clearing the address
- [X] T033 [P] Remove `GOOGLE_MAPS_BROWSER_KEY` from `scripts/ci/e2e.sh`. CI stays on `PLACE_PROVIDER=fixture` and does not export a map key
- [X] T034 Run the fixture-provider scenarios in `specs/015-garden-location-weather/quickstart.md` (`npm test` and `npm run e2e`). The create flow confirms an OpenStreetMap embed URL with no API key (depends on T018, T033)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on T001 — blocks all stories
- **User Story 1 (Phase 3)**: Depends on Phase 2. T006 blocks the map tasks
- **User Story 2 (Phase 4)**: Depends on a stored place (T011). Already implemented
- **User Story 3 (Phase 5)**: Depends on stored coordinates (T011). Does not need User Story 2. Already implemented
- **Polish (Phase 6)**: T034 depends on the OpenStreetMap map tasks

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2. No dependency on US2 or US3
- **User Story 2 (P2)**: After US1 place save. Independently testable by saving a fixture place and reading zone, frost, and `seasonNotice`
- **User Story 3 (P3)**: After US1 place coordinates. Independently testable with a stored place and the fixture forecast, even if zone and frost are still empty

### Within Each User Story

- Vitest for the OpenStreetMap change (T009) is written so it fails before T006 and T013
- Nominatim adapter (T013) before the controller bind (T014)
- Drop the map-key client (T015) before the pages (T016, T017)
- Playwright (T018) after those pages
- T016 and T017 can run together after T006 and T015

### Parallel Opportunities

- T002 and T003 (done)
- T009, T013, and T015 (different files)
- T016 and T017 after T006 and T015
- T019 and T020 (done)
- T025, T026, and T028 (done)
- T033 alongside the User Story 1 map tasks (different file)

---

## Parallel Example: User Story 1

```bash
# After T006, these touch different files:
Task: "T009 place-lookup.spec.ts OpenStreetMap URL and Nominatim filter"
Task: "T013 NominatimPlaceLookup"
Task: "T015 Remove MapKeyDto and the map-key client"

# After T015:
Task: "T016 garden-list.page.ts embed without a key"
Task: "T017 garden-detail.page.ts embed without a key"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Finish T006
2. Finish T009 and T013–T018
3. Stop and run the User Story 1 independent test (OpenStreetMap map, rejected address, null place still opens, no map key)

### Incremental Delivery

1. Setup + foundational place columns are already in the tree
2. User Story 1 remaining work → Nominatim lookup and OpenStreetMap map with no paid key
3. User Story 2 → zone and frost already follow the address
4. User Story 3 → watering is already not required when that day’s rain is at least 2.5 mm
5. Polish → remove the CI map key and run `npm test` / `npm run e2e`

### Parallel Team Strategy

After T006, one person can take Nominatim (T013, T014) while another removes the map-key client and updates the two garden pages (T015–T017). User Story 2 and User Story 3 do not need to be rebuilt.

---

## Notes

- [P] tasks use different files and do not depend on incomplete tasks
- Checked tasks are already implemented. Do not rewrite them to call Google
- Do not call Nominatim, phzmapi, FarmSense, or Open-Meteo from Vitest or Playwright
- `PLACE_PROVIDER=live` that cannot reach Nominatim returns the unavailable message, not fixture pins. There is no map API key
- Exact strings to preserve: `A garden address is required`, `That address could not be found`, `Type a street address. A city, region, or country is not a garden site.`, `Type a more specific address.`, `Place lookup is unavailable. Try again when you are online.`, `A confirmed garden address is required`, `Viewers cannot update this garden`, `Growing zone and frost dates were updated from this address.`, `This place was saved. Enter the growing zone and frost dates that could not be determined.`, `Rain expected — you don't need to water.`, `The map is unavailable.`, `No address is set`

---

## Phase 7: Convergence

- [X] T035 Show `The map is unavailable.` in `apps/web/src/app/gardens/garden-list.page.ts` and `apps/web/src/app/gardens/garden-detail.page.ts` when the OpenStreetMap iframe does not finish loading, not only when its `error` event fires. Keep **Create garden** disabled until a map loads. On a saved garden, keep the address, zone, and frost visible and do not block those edits. In `apps/web-e2e/src/garden-place.spec.ts`, abort the `openstreetmap.org/export/embed` response and expect that sentence without dispatching a synthetic `error` event per spec edge case: map picture cannot be loaded (partial)
