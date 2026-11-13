# ADR 0023: Zone and frost dates from Open-Meteo history

## Status

Accepted. Supersedes the climate source in [ADR 0016](0016-garden-place.md).
NASA POWER was added as fallback or sole source in [ADR 0028](0028-nasa-power-climate-source.md).

## Context

A property's hardiness zone came from phzmapi.org, which needs a US ZIP
code, and its frost dates from FarmSense, whose US station data and host
are old. Every garden outside the US, and many inside it, got neither, and
the calendar's sowing windows hang off frost dates.

## Decision

1. **One source, worldwide.** `LiveClimateLookup` downloads 30 full years of
   daily minimum temperature at the property's coordinates from Open-Meteo's
   historical weather API (ERA5 reanalysis; no key, already used for the
   rain outlook) and computes both facts locally in
   `climateFromDailyMinimums`. phzmapi.org and FarmSense are removed.
2. **Frost dates.** A frost is a daily minimum at or below 0 °C. Each growing
   year runs from midwinter to midwinter: 1 January in the north, 1 July in
   the south. Its last frost is the latest frost before midsummer and its
   first frost the earliest after. The property gets the median of each
   over the years; a year with no frost on one side counts as frost-free, so
   a place where most years are frost-free gets no date. Years with more than
   65 missing days are skipped.
3. **Zone.** The mean of each year's lowest minimum, in the USDA 10 °F bands
   from -60 °F (zone 1) to 60 °F and above (zone 13). The bands are just
   numbers, so they work anywhere.
4. **The season may wrap the year end.** South of the equator (latitude
   below 0) last frost (spring) falls later in the calendar year than first
   frost (autumn). `frostInOrder` holds the rule for both hemispheres;
   computed pairs and pairs a household types are kept only in their
   hemisphere's order, and a property with no place follows the north.
   Sowing windows are worked out in real years: last frost in the season's
   year, first frost in the next one when the season wraps, so a window that
   crosses 29 February or the year end lands on the right day. The season's
   year is this year, or last year while a wrapping season has not reached
   its first frost.
5. **Same failure rule.** A failed or odd response leaves zone and frost
   unset and still saves the place; the household can set them by hand.

## Consequences

+ Properties anywhere get a zone and frost dates, and the calendar's
  windows follow a southern season across the year end.
- A southern property's calendar still lists crops in January-to-December
  order; it starts with what is upcoming, but the season reads across the
  year end.
- ERA5 cells are about 10 km across, so a frost pocket or a valley colder
  than its cell gets dates that are too mild, and a city's heat island the
  reverse. The dates stay editable.
- Only median (50%) dates; a 10%-risk date and a fallback source (NASA POWER
  or NOAA GSOD) for operators Open-Meteo's non-commercial terms do not suit
  are still on the roadmap.
- Each lookup downloads about 11 000 values (a few hundred kB). Lookups
  happen when a property's place is saved, so there is no cache.
