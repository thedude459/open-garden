# Quickstart: Garden Location and Weather

**Feature**: `015-garden-location-weather`

Proof for [spec.md](./spec.md). HTTP shapes: [contracts/rest-api.md](./contracts/rest-api.md). Screens: [contracts/garden-place-ui.md](./contracts/garden-place-ui.md). Columns: [data-model.md](./data-model.md).

## Prerequisites

Host path: Postgres up, catalog seeded, signed in (`gardener@example.com` / `password123`).

```bash
npm run api:serve
npm run web:serve
```

Local and CI keep `PLACE_PROVIDER=fixture` (the default). Do not call Nominatim. For a real map and forecast, set `PLACE_PROVIDER=live`. No map API key is required. The iframe is an OpenStreetMap embed.

## 1. Confirmed address on create (SC-001)

1. Gardens → type a name and `1600 Pennsylvania Avenue NW, Washington, DC`.
2. **Expect**: one place selected, and an iframe `src` on OpenStreetMap that includes that place’s coordinates and no API key.
3. Create. **Expect**: `seasonNotice` that zone and frost were updated. Configuration shows the same address and map. Overview’s bed plan has no place map.

## 2. Reject a bad address (SC-005)

1. Look up `Nowhere`. **Expect**: `That address could not be found`. No garden is created.
2. Look up `France`. **Expect**: `Type a street address. A city, region, or country is not a garden site.` No garden is created.
3. Open a garden that has no place. **Expect**: it still opens. Configuration says no address is set. Its watering tasks stay required.

## 3. Several matches

1. Look up `100 Main Street`. **Expect**: two street-level choices, nothing selected for you.
2. Pick one, then save. **Expect**: the map and the stored address match that choice.

## 4. Zone and frost follow the address (SC-002)

1. On the Washington garden, change zone by hand and save **without** changing the address. Reopen. **Expect**: the hand-edited zone remains.
2. Save a different fixture candidate as the address. **Expect**: zone and frost match that place, and the notice says they were updated from the address.
3. A fixture place whose climate adapter returns nothing keeps the map and shows the hand-entry notice. Zone and frost are unset. No guessed dates.

## 5. Rain and watering (SC-003, SC-004)

1. With the Washington place saved, open reminders with `asOf` on a day the fixture forecast marks as 5 mm. **Expect**: watering rows say `Rain expected — you don't need to water.`, stay on the list, and are not shown as overdue. Fertilize and harvest are unchanged.
2. Mark one watering done. **Expect**: it completes the same way as before.
3. Open reminders for another `asOf` (fixture rain 0 mm). **Expect**: watering is required and has no rain note.
4. Save a second garden at one `100 Main Street` candidate (fixture rain 0 mm) while the Washington garden expects 5 mm. **Expect**: only the Washington watering is not required. The Main Street watering stays required. A garden with no place also stays required.
5. Stop the forecast adapter (or use a garden whose rain port fails). **Expect**: reminders still load and watering is required.

## 6. Roles (SC-004, SC-006)

1. Viewer: configuration shows address, map, zone, and frost, with no controls to change them (`Viewers cannot update this garden`). On a rainy day the viewer sees `Rain expected — you don't need to water.` and cannot mark it done.
2. A signed-in user who is not a member gets `Garden not found` for that garden’s detail and reminders, and does not see the address, map, or rain note.

## Automated

```bash
npm test
npm run e2e
```

Unit tests cover zone `8a` → `8`, invalid frost pairs stored as unset, address change replacing hand edits, and watering `required` only when that `dueOn` is ≥ 2.5 mm. Playwright covers the steps above against the fixture provider.
