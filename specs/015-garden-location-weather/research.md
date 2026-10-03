# Research: Garden Location and Weather

**Feature**: `015-garden-location-weather` | **Date**: 2026-10-03

## 1. Where the rules live

**Decision**: New Nx lib `libs/garden-place` holds the place port, climate port, rain port, fixture adapters, live adapters, and the pure helpers (`zoneNumberFromLabel`, frost-pair check, rain threshold). `libs/gardens` keeps create/update/authZ and calls the climate port when a place is saved. `libs/care-reminders` gains `applyRainCover` and does not fetch weather. Angular and Nest bind ports; they do not contain the rules.

**Rationale**: Constitution library-first, and the same split 006 used (pure derive in the lib, HTTP at the edge). Tests can run without Nominatim or a database.

**Alternatives considered**:

- Put HTTP in `GardenService`: mixes membership with vendors and breaks the plant-provider rule’s intent.
- A general “geo” framework: one garden address does not need it.

**ADR**: `docs/adr/0016-garden-place.md` (implementation).

## 2. Confirming an address

**Decision**: Server-side Nominatim search (`GET https://nominatim.openstreetmap.org/search`) with no API key. Keep a result only when it is street-level: it has a house number, or its address rank is a building or house. Drop country, state, region, and city results. If none remain, lookup is 400 `Type a street address. A city, region, or country is not a garden site.` The client may save only a candidate from that response. A query returns at most 5 street-level candidates (`formattedAddress`, `latitude`, `longitude`, `placeId`, `postalCode`, `countryCode`). `placeId` is the OpenStreetMap object id. More than 5 sets `truncated: true`; the gardener must type a more specific address. Zero results is `That address could not be found`. Nominatim down or a non-OK response is `Place lookup is unavailable. Try again when you are online.` The client must select one candidate. Save sends that candidate. The server does not pick among matches and does not invent a pin.

The map the gardener sees is an OpenStreetMap embed iframe, built by a pure function with no API key:

`https://www.openstreetmap.org/export/embed.html?bbox={west},{south},{east},{north}&layer=mapnik&marker={lat},{lng}`

The marker is the candidate’s latitude and longitude. The bbox is a small box around that point. There is no Maps npm package. The live geocoder sends a User-Agent that names Open Garden. That is not an API key and is not an environment variable. Saving a place is not gated on a map key. If the iframe fails to load, the map area says the map is unavailable.

`PLACE_PROVIDER=fixture` (default for local/CI, same idea as `PLANT_PROVIDER`) returns canned candidates and never calls Nominatim. `PLACE_PROVIDER=live` is Nominatim. A live failure returns the unavailable error, not fixture data. `.env` has no map key.

**Rationale**: The spec requires an OpenStreetMap map, a free address lookup, and a human choice when several places match. An embed iframe is that map without a new dependency or a billing account. Fixture mode keeps e2e deterministic.

**Alternatives considered**:

- Google Geocoding and Maps Embed: requires a paid key and a billing account. Rejected.
- A draggable pin with a Maps JavaScript loader: extra package; the spec does not ask for an unnamed pin drop.
- Client-side geocoding: the browser would call Nominatim directly and skip the session check.

## 3. Zone and frost

**Decision**: On save of a place, the climate port runs. Results write the existing `hardiness_zone` and frost month/day columns. Client-sent zone and frost are ignored on that request. A later PATCH that does not include `place` keeps hand edits.

- **Zone**: `GET https://phzmapi.org/{zip}.json` when `countryCode` is `US` and `postalCode` is 5 digits. `zone` like `8a` becomes integer `8` (`zoneNumberFromLabel`). 404, non-US, or a number outside 1–13 leaves zone unset.
- **Frost**: FarmSense, no key. `GET https://api.farmsense.net/v1/frostdates/stations/?lat=&lon=` then probabilities for the nearest station. Season `1` is spring (last frost). Season `2` is fall (first frost). Use temperature threshold `32` and `prob_50` (`MMDD` → month/day). If either date is missing, or last frost is not earlier in the calendar year than first frost, store neither frost date.

Partial climate still saves the place. The write response includes `seasonNotice`:

- Both zone and both frost dates filled: `Growing zone and frost dates were updated from this address.`
- Anything missing: `This place was saved. Enter the growing zone and frost dates that could not be determined.`

**Rationale**: phzmapi is a static USDA-derived ZIP file with no key. FarmSense is the smallest keyless lat/lng frost API and already speaks NOAA 32°F probabilities, which match this product’s spring-last / fall-first rule. The spec already requires hand entry when season facts cannot be determined.

**Ceiling**: FarmSense’s dataset and host are old. If stations or probabilities fail, frost stays unset. Upgrade path: vendor NOAA 1991–2020 median 32°F normals and look up the nearest station locally. Do not block place save on frost.

**Alternatives considered**:

- Compute frost from Open-Meteo history: a multi-decade download per save.
- NOAA CDO at runtime: free token, awkward datatype ids, operator setup for a value the spec allows to be empty.
- Store sub-zone `8a`: the garden column is an integer 1–13.

## 4. Rain and watering

**Decision**: Do not store forecasts. On `GET /api/gardens/:id/reminders`, if the garden has a place, the rain port calls Open-Meteo:

`GET https://api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=rain_sum&timezone=auto&forecast_days=16`

Use `rain_sum` (mm of rain), not `precipitation_sum` (that includes snow). A watering item is not required only when the daily value for its `dueOn` is ≥ 2.5. Then `required` is false and `rainNote` is `Rain expected — you don't need to water.` The item stays in the list. Sort order is unchanged. Urgency stays the date relation; the UI treats `required: false` as not overdue. Complete and dismiss are unchanged. Fertilize and harvest always have `required: true` and `rainNote: null`.

If the garden has no place, the due day is absent from the forecast (including a past day), the value is under 2.5, or the request fails or exceeds 3 seconds: `required` stays true and `rainNote` stays null. The reminder list still returns 200. `outlookOn` is the request’s `asOf` when the forecast was read, otherwise null. A cached list whose `outlookOn` is not the device’s local date MUST be shown with every watering required.

No in-memory cache in v1. One Open-Meteo call per reminders GET.

**Ceiling**: Per-GET fetch is enough for a household. Upgrade path is a short process cache keyed by rounded coordinates and local date.

**Rationale**: Matches the clarified rule (visible, not completed, required again when the due day is no longer wet). Open-Meteo needs no key. Failing open keeps watering required.

**Alternatives considered**:

- Auto-dismiss or auto-complete: rejected in clarify.
- Any chance of rain, or rain on another day: rejected in clarify.
- A paid weather API: Open-Meteo already covers the rain rule with no key.

## 5. What is not stored

**Decision**: Persist only the confirmed place on `gardens`. Zone and frost stay the columns from 002. Postal code and country are inputs to the climate call at save time, not columns. Rain is a field on the reminder DTO, not a table, and it does not write `garden_care_events`.

**Rationale**: Re-saving a place refills climate. A forecast from yesterday must not skip today’s watering, so it must not be durable.

**Alternatives considered**: A `garden_forecasts` table — stale rain is worse than a refetch.
