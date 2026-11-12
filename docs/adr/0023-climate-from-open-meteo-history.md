# ADR 0023: Zone and frost dates from Open-Meteo history

## Status

Accepted. Supersedes the climate source in [ADR 0016](0016-garden-place.md).

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
4. **Same failure rule.** A failed or odd response leaves zone and frost
   unset and still saves the place; the household can set them by hand.

## Consequences

+ Properties anywhere get a zone, and Northern Hemisphere properties get
  frost dates.
- Southern Hemisphere frost dates are computed but still dropped by
  `keepFrostPair` until the calendar handles a season that wraps the year
  end (the next slice).
- ERA5 cells are about 10 km across, so a frost pocket or a valley colder
  than its cell gets dates that are too mild, and a city's heat island the
  reverse. The dates stay editable.
- Only median (50%) dates; a 10%-risk date and a fallback source (NASA POWER
  or NOAA GSOD) for operators Open-Meteo's non-commercial terms do not suit
  are still on the roadmap.
- Each lookup downloads about 11 000 values (a few hundred kB). Lookups
  happen when a property's place is saved, so there is no cache.
