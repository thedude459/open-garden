# Data Model: Garden Location and Weather

**Feature**: `015-garden-location-weather` | **Date**: 2026-10-03  
**Spec**: [spec.md](./spec.md)

Place is stored on the garden. Zone and frost stay the existing site columns. Rain is computed when reminders are listed and is not stored.

## Garden place (columns on `gardens`)

Migration `0010_garden_place.sql`. Existing rows stay all-null and remain valid.

| Field | Type | Rules |
|-------|------|-------|
| formatted_address | text \| null | Trimmed, 1–300 characters when set |
| latitude | double precision \| null | −90 through 90 when set |
| longitude | double precision \| null | −180 through 180 when set |
| place_id | text \| null | Non-empty when set; OpenStreetMap object id, or a fixture id |

**Together**: all four are null, or all four are set. A street without a pin is not saved. Addresses are not unique across gardens.

**Not columns**: postal code, country, forecast, `seasonNotice`. Postal code and country ride on the save request only so the climate port can run.

## Site profile (existing columns)

| Field | When a place is saved |
|-------|------------------------|
| hardiness_zone | Replaced by the climate port, or set null if unknown. Integer 1–13. `8a` is stored as `8`. |
| last_frost_month / last_frost_day | Replaced together, or both null |
| first_frost_month / first_frost_day | Replaced together, or both null |

Existing check `gardens_frost_order` stays: when both frost dates are set, last frost is earlier in the calendar year than first frost. The climate port MUST NOT write a pair that fails that check; it writes both null instead.

A PATCH that omits `place` does not change these columns except for the zone and frost fields in that PATCH (today’s behavior).

## Reminder list (not stored)

`ReminderItemDto` gains:

| Field | Type | Rules |
|-------|------|-------|
| required | boolean | `false` only for `kind: "water"` when that `dueOn` has forecast `rain_sum` ≥ 2.5 mm. Otherwise `true`. |
| rainNote | string \| null | `Rain expected — you don't need to water.` when `required` is false. Otherwise null. |

`ReminderListDto` gains:

| Field | Type | Rules |
|-------|------|-------|
| outlookOn | string \| null | The request `asOf` when a forecast was read. Null when there is no place or the forecast was not read. |

`urgency` and sort are unchanged. `required: false` does not remove the row and does not insert a care event.

## State

```text
no place
  → lookup candidates (none | some | unavailable)
  → gardener picks one and sees the OpenStreetMap map
  → save place (create requires this; older gardens may skip)
  → climate fill overwrites zone and frost (partial fill allowed)
  → later place save overwrites zone and frost again
  → PATCH without place keeps hand-edited zone and frost

reminders GET
  → derive as today
  → if place and forecast has dueOn ≥ 2.5 mm rain: water.required = false
  → else water.required = true
  → complete/dismiss still write garden_care_events as today
```

## Access

| Actor | Place | Zone / frost | Rain flags |
|-------|-------|--------------|------------|
| Owner, collaborator | Read, set, change | Read; correct only when not sending a new place | Read; complete/dismiss as today |
| Viewer | Read | Read | Read |
| Non-member | 404 | 404 | 404 |

## Offline

Lookup and saving a place are online-only. The map embed needs no API key. A previously loaded garden detail and reminder list stay readable. If the cached reminder list has `outlookOn` other than the device’s local date, the client shows every watering as required.
