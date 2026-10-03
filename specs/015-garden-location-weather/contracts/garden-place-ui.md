# Garden Place UI Contract

**Feature**: `015-garden-location-weather`  
**Routes**: garden list create form; `/gardens/:id/configure` (existing configuration page). The bed layout route does not gain a map.

## Create (garden list)

1. Name stays required. Address is a text field. Notes stay optional.
2. The gardener submits the address for lookup (`POST /api/places/lookup`) before the garden is created.
3. Zero matches, a city/region/country-only result, or an unavailable lookup shows the API `error.message`. No garden is created.
4. Two or more candidates: a choice list. The map and the save action use the selected row only. The page does not pick a row by itself. If `truncated` is true, show `Type a more specific address.`
5. One candidate is selected automatically.
6. Selected candidate: an iframe whose `src` is the OpenStreetMap embed URL from `libs/garden-place`. The URL has the candidate coordinates and no API key. The iframe is not inside the bed plan.
7. The iframe fails to load: the map region says the map is unavailable. **Create garden** stays disabled. A garden is not created without a loaded map. A missing map key is not a reason to disable create.
8. **Create garden** sends `place` equal to the selected candidate. It does not send hand-typed zone or frost on that request.
9. After 201, stay on the gardens list. Show `seasonNotice` if it is non-null. Do not open Overview.

Offline: lookup and create show that the gardener needs to be online. Nothing is queued.

## Configuration

1. Members see `formattedAddress` and the same OpenStreetMap embed when a place is stored. No place: “No address is set” and no pin. The embed URL has no API key.
2. Map image failed: address, zone, and frost still show; the map region says the map is unavailable. That failure does not block reading or saving zone and frost on a garden that already has a place.
3. Owner and collaborator can look up a new address the same way as create, including the truncated hint and the street-address rejection. Offline, lookup and save of a new address show that the gardener needs to be online. Nothing is queued. Saving a new place shows `seasonNotice` and the refilled zone and frost.
4. Saving zone or frost without a new place does not clear the place and does not show the season notice.
5. Viewer sees address, map, zone, and frost, and cannot edit them.
6. This page is not the bed layout. Garden Overview does not add this map.

## Reminders

1. A water row with `required: false` stays visible, shows `rainNote`, and is not styled as overdue work.
2. Owner and collaborator can still mark that row done.
3. If the cached list’s `outlookOn` is not today’s local date, show every water row as required and do not show `rainNote`.
4. Fertilize and harvest rows look the same as before this feature.
5. A viewer sees the same `rainNote` as other members and cannot edit zone, frost, or the address. A signed-in non-member does not see this garden’s reminders or address.
