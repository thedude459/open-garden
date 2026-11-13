# ADR 0028: NASA POWER as a second climate source

## Status

Accepted. Extends [ADR 0023](0023-climate-from-open-meteo-history.md).

## Context

Zone, frost dates, 1-in-10 dates, and monthly temperatures all come from 30
years of daily temperatures (ADR 0023, 0025, 0027), so far from Open-Meteo
alone. Open-Meteo's free tier is for non-commercial use, and when it is down
a new property gets no climate at all.

## Decision

1. **NASA POWER behind the same port.** `NasaPowerClimateLookup` asks NASA
   POWER's daily point API (MERRA-2 reanalysis, about 50 km cells; public
   domain, no key) for the same 30 full years of daily minimum and mean
   temperature, and runs the same calculation. `-999`, its missing-value
   marker, is treated as missing.
2. **Fallback by default.** `CLIMATE_SOURCE=open-meteo` (the default) asks
   Open-Meteo and, when it returns nothing for the place (unreachable,
   refused, or no data), NASA POWER. `CLIMATE_SOURCE=nasa-power` uses NASA
   POWER only, for installs whose use does not fit Open-Meteo's terms. The
   boot check refuses any other value. `climateLookupFor` picks the lookup,
   so the API wires it in one place.
3. **Rain stays with Open-Meteo.** The rain outlook is a forecast; NASA
   POWER has none.

## Checked on real data (November 2026)

| Place | Source | Zone | Last frost (1 in 10) | First frost (1 in 10) |
|---|---|---|---|---|
| Washington, DC | Open-Meteo | 7 | 1 Apr (11 Apr) | 14 Nov (5 Nov) |
| Washington, DC | NASA POWER | 7 | 2 Apr (11 Apr) | 10 Nov (30 Oct) |
| Minneapolis | Open-Meteo | 4 | 23 Apr (4 May) | 24 Oct (7 Oct) |
| Minneapolis | NASA POWER | 4 | 29 Apr (16 May) | 10 Oct (2 Oct) |
| Melbourne | both | 10 | frost rare | frost rare |
| Honolulu | both | 13 | frost rare | frost rare |

The two agree within a few days, and the frost dates are in line with
published station medians. Zones come out about one colder than the 2023 USDA
map (8a for DC, 5a for Minneapolis), likely because a reanalysis cell
averages over more than the city.

## Consequences

+ An install can run with no Open-Meteo dependency for climate, and an
  Open-Meteo outage no longer leaves a new property without one.
- NASA POWER's coarser cells make its dates a little more extreme in hilly
  or coastal places; the household can edit them.
- Zones can read one colder than the USDA map; households can set theirs.
