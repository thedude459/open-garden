# ADR 0038: Harvest totals

## Status

Accepted.

## Context

Phase 4 item 10 asks for yields per crop per year. Each harvest day was
already kept in `garden_planting_harvests` (one row per planting and day,
written when a planting was marked harvested or a Harvest task completed),
but with no amount, and nothing showed the rows. Households weigh some crops
(beans, tomatoes by the basket) and count others (zucchini, melons, heads of
lettuce).

## Decision

1. **A weight, a count, both, or neither.** Migration 0018 adds `grams` and
   `count` (whole numbers, 0 or more, both optional) to each harvest day.
   Weights are stored in grams and typed and shown in the member's units:
   pounds (ounces under a pound) or kilograms (grams under a kilogram). A
   count is "picked" items, whatever the crop's unit.
2. **One row per day.** Logging a second harvest of a planting on the same
   day adds to that day's weight and count (picking twice), so the unique
   (planting, day) row stays and totals never double count.
3. **Logging.** `POST …/plantings/:id/harvests` (editors) records a day and
   its amounts; `DELETE …/plantings/:id/harvests/:day` removes one, and clears
   the planting's harvested mark when it was that day. Logging does not mark
   the planting harvested: beans and tomatoes are picked for weeks. Members
   log from a planting's editor (with its list and total) or type an amount
   next to a Harvest task before completing it. Like soil tests (ADR 0033),
   amounts need a connection; the task itself still completes offline.
4. **Totals.** `GET …/harvests?season=YYYY` (any member) returns one season's
   harvests by crop, a variety's counting toward its crop, with weight and
   count totals and each harvest listed, plus the seasons that have any. The
   season is the planting's season (`season_year`), so a Southern Hemisphere
   season that crosses the year end stays one season. The Harvests tab, next
   to Layout and Plantings, shows them with a season picker.

## Consequences

- Weight and count are totalled separately; a crop logged both ways shows
  both ("3.3 lb and 6 picked"). There is no conversion between them.
- Harvests logged before this change have no amounts and show as a dash.
- Comparing seasons is one season at a time; a side-by-side view, and yields
  per bed or per square foot, wait until households ask.
