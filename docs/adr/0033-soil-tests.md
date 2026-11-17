# ADR 0033: Soil tests per area, with a bed's own test winning

## Status

Accepted.

## Context

Phase 4 item 5: a household that sends soil to a lab gets back pH, organic
matter, and nutrient levels, and the lab's own recommendations. The app
should keep that report with the ground it came from and use it to advise on
what grows there. The dataset has carried each crop's `soilPh` range since
v0.2.0 and the app imports it (`plants.soil_ph_min`, `soil_ph_max`), but
nothing compared it with the soil.

A property holds the address, zone, and climate; its typed areas (vegetable
garden, orchard, bramble patch, greenhouse) hold the beds (principle VIII).
A lab sample is usually one mix from an area of the same ground: an in-ground
vegetable garden, an orchard, a bramble patch. Some beds differ from their
area: a raised bed is filled with brought-in soil, and a bed amended for
blueberries has been lowered with sulfur.

Labs differ in extraction method and units, and lime or fertilizer rates
depend on texture and buffer pH. The app cannot turn a raw number into a
rate without regional data it does not have yet.

## Decision

1. **A test belongs to an area or to a bed.** Table `garden_soil_tests`
   (migration 0015) has `area_id` or `bed_id`, exactly one (a check
   constraint): date tested, lab, pH, organic matter %, nitrogen, phosphorus
   and potassium as the level the lab reported (low, medium, high), and the
   lab's recommendations as written. Every result is optional, but a test
   needs at least one. Deleting the bed or area deletes its tests. A test
   cannot be dated in the future (a day of slack for time zones ahead of UTC).
   A greenhouse grows in trays, so it takes no area test.
2. **Which test speaks for a bed:** the bed's own latest test, or else its
   area's latest. Latest means the latest date, then the latest entered, so
   re-entering a corrected test for the same date replaces the first in
   effect. Older tests are kept as history; the app shows only the latest for
   now.
3. **API.** `POST /gardens/:id/areas/:areaId/soil-tests` and
   `POST /gardens/:id/beds/:bedId/soil-tests` record one;
   `DELETE …/soil-tests/:testId` on either removes one entered by mistake and
   answers with that area's or bed's latest test now. Members who can change
   beds can do both; viewers cannot. The plan (`GET /gardens/:id/layout`)
   carries each bed's area and own latest test, each area's latest test
   (`areaSoilTests`), and each planting's crop pH range, so the advice needs
   no extra request.
4. **Advice, never a block** (`garden-layout`, `soil-advice.ts`):
   - On the plan, a plant where the tested pH is outside its crop's range gets
     a note: "Tomato needs pH 6.0–7.0; the soil here tested 7.2: lower it
     with sulfur over a season" (or "raise it with lime"). Direction only, no
     rate.
   - In an area's or a bed's panel: organic matter below 3% suggests compost;
     a nutrient reported low points to the lab's recommendation (or the lab or
     extension office when there is none); a test three or more years old
     asks for a new one, since extension services advise every 2–3 years. A
     bed without its own test shows its area's.
5. **Online only.** A lab report is entered once, at a desk; the form needs
   the server rather than the offline queue.

## Consequences

- Soil tests live in `seasonal-plantings` (`SoilTestService`, next to beds
  and areas) and the data library; no new library for a table and four
  endpoints.
- No application rates until the dataset carries them (roadmap: amendment
  advice from dataset v0.4); the lab's recommendation is shown as written.
- Area tests are recorded from the plan's Areas list, which only editors
  see; viewers see the pH notes but not the tests. Areas themselves can only
  be added today: renaming, deleting, and drawing them on the plan is the
  next roadmap step, and the area view it brings is where tests belong.
- The report PDF, test history, and soil by location (before any test) are
  later slices.
