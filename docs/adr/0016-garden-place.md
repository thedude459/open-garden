# ADR 0016: Garden place, season facts, and rain

## Status
Accepted

## Context
A garden needs a street address so the product can show where it is, fill growing zone and frost dates, and skip watering when that day's forecast is already wet enough. Vendor calls must stay behind ports, the same way plant data does.

## Decision
Store `formatted_address`, `latitude`, `longitude`, and `place_id` on `gardens`. All four are null or all four are set. Postal code and country are not columns; they travel on the save request so the climate port can run.

`libs/garden-place` owns three ports: geocoding, climate, and rain. `PLACE_PROVIDER=fixture` is the default. `PLACE_PROVIDER=live` uses Nominatim for address lookup, phzmapi for US zone, FarmSense for frost, and Open-Meteo `rain_sum`. The map is an OpenStreetMap embed iframe. There is no Maps npm package and no map API key. A household does not need a billing account to look up an address or see the garden.

Rain is applied when reminders are listed. It never writes `garden_care_events`. A FarmSense failure leaves frost unset and still saves the place.

## Consequences
+ Address, map, zone, frost, and watering rain share one place record
+ CI stays deterministic without calling Nominatim or OpenStreetMap
+ Address lookup and the garden map need no paid API key
- Live frost depends on an old FarmSense host; the upgrade path is vendored NOAA 1991–2020 normals
