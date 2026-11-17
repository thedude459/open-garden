# ADR 0032: Frost and heat alerts from the forecast

## Status

Accepted.

## Context

Phase 4 item 3, the first of the care features (implementation order step 8):
warn a household when frost or heat in the next few days can hurt what is
growing, through the reminders they already get (Today, web push, the daily
email, ADR 0022). Open-Meteo already supplies the rain outlook for watering
reminders, so no new provider is needed.

What a crop can take is crop data. The dataset has carried `frostTolerance`
(tender, half-hardy, hardy) for every crop since v0.1, and `temperatureC.max`
(the top of its growing range, imported as `growMaxC` in ADR 0025); the app
read the second but not the first.

## Decision

1. **Import `frostTolerance`.** A `frost_tolerance` column on `plants`
   (migration 0014), filled by the dataset importer for each crop and its
   varieties.
2. **A temperature outlook behind a port.** `TemperatureOutlook` in
   `garden-place` returns each day's forecast low and high from today for four
   days. `OpenMeteoTemperatureOutlook` asks Open-Meteo for
   `temperature_2m_min,temperature_2m_max` (3 s timeout, `null` on failure)
   and keeps each answer for an hour, so Today and the daily reminders share
   one request per property. `PLACE_PROVIDER` picks it or
   `FixtureTemperatureOutlook` (a −2 °C night tomorrow at the Washington test
   address), as for places and climate.
3. **The rules, in `care-reminders`** (`weatherAlerts`, pure):
   - **Frost:** tender crops when the forecast low is 1 °C or below (a clear
     night frosts the ground with the air just above freezing); half-hardy
     crops at −2 °C or below (a hard frost); hardy crops never.
   - **Heat:** any crop when the forecast high is above its `growMaxC`.
   - For each, the soonest day at risk and every plant at risk that day, once
     per bed. Only plants in beds that are not harvested count: trays and
     waiting transplants are under cover.
   - Advice only. Nothing is blocked.
4. **Delivered with Today.** `TodayDto.alerts` carries each property's
   alerts. The Today page shows them first, under **Weather**. The daily push
   leads with the first alert and is sent for an alert alone; the daily email
   lists alerts under their property and names the first in its subject.
   Temperatures use the member's units. The wording ("Frost likely Wed,
   Nov 18 (low 28 °F)", "cover Tomato (North)") lives in one place,
   `reminder-delivery`'s `messages.ts`, which the web app also imports.

## Consequences

- A forecast that cannot be read means no alert, never a failed Today page.
- Each Today load asks the forecast once per property per hour; a household
  install with a few properties stays well within Open-Meteo's free use.
- The thresholds are a simple reading of the dataset's tolerance classes. A
  crop with its own frost temperature in the dataset would replace them.
- Plants in a cold frame or under fleece are warned about like any other: the
  app does not know about covers yet.
