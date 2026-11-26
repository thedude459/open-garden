# ADR 0045: Pest advice on plant pages, by the member's country

## Status

Accepted. First part of roadmap step 13; scouting reminders are decided
later (step 13c).

## Context

open-garden-data v0.3.2 publishes 26 pests and diseases organized for
integrated pest management (IPM). Each pest has a shared part (names, signs,
the crops it attacks, the crop stages to look at, and controls that need no
product: cultural, physical, biological) and one or more **regions**. A region
names where its guidance comes from, its country (ISO 3166-1 alpha-2), the
USDA zones it covers, when to look, a threshold, its products (`organic`, then
`conventional`, [ADR 0044](0044-organic-first-advice.md)), and a reference. A
pest may say which countries it is known in (`occursIn`, from the EPPO Global
Database).

Pests differ by region: timing in Minnesota is wrong in California, and a
product registered in the US may not be legal in Canada or the EU. Properties
did not keep their country; the address lookup returned one, but only the
address, point, and zone were stored.

## Decision

1. **`catalog_pests`, replaced by the import.** The dataset provider exposes
   `pests()`, like `companions()` (ADR 0030). The catalog import replaces the
   table in the transaction that writes plants; an unchanged run leaves it.
   The unchanged-catalog hash covers pests, so a release that changes only
   pests is still written. Regions and controls are stored as `jsonb`: they
   are read whole with their pest and never queried by field. A GIN index on
   `crops` finds a crop's pests.
2. **Products never come from the shared part.** The provider empties the
   shared `organic` and `conventional` lists, whatever a release holds;
   products are only regional.
3. **Properties keep their country** (`gardens.country_code`), upper-cased
   from the address lookup and kept only when it is two letters. Existing
   properties have none until their address is saved again.
4. **Which guidance a member sees** (`pestsForPlaces`, `libs/plant-catalog`),
   from the countries and zones of every property they belong to:
   - A pest known only in other countries is left out. A pest with no
     `occursIn` is kept.
   - **`country`:** a region in one of their countries, the one nearest their
     zones.
   - **`nearest`:** when any property's country is unknown and no region
     matches a known one, the region nearest their zones, labelled with where
     it is from and how to get local guidance (add the address).
   - **`none`:** their countries have no region. The page shows the shared
     signs and controls and says there is no timing or products for their
     country, rather than another country's products.
5. **The plant page** lists the crop's pests after companions: signs, the
   stages to look at, the steps that need no product, then the region's
   timing, threshold, and organic products, with where it is from and its
   reference. Conventional products show only when the member ticks "Show
   conventional options", for that page view; when guidance names no organic
   product, the page says so instead of falling back to a conventional one.
   It says the label is the law and to choose products labelled for organic
   use. Details cached offline before pests existed get an empty list.

## Consequences

- A member with properties in two countries sees guidance from one of them
  per pest (nearest by zone). A per-property choice belongs with the scouting
  task, which knows its property.
- The conventional toggle is not remembered. A household setting can come
  when a household asks for it (ADR 0044 allows one).
- Step 13c (a weekly "scout this bed" task) decides reminder load, crop stage
  from FAO stage lengths, sightings, and "not a problem here", in its own ADR.
