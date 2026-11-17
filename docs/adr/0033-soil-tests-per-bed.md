# ADR 0033: Soil tests per bed

## Status

Accepted.

## Context

Phase 4 item 5: a household that sends soil to a lab gets back pH, organic
matter, and nutrient levels, and the lab's own recommendations. The app
should keep that report with the bed it came from and use it to advise on
what grows there. The dataset has carried each crop's `soilPh` range since
v0.2.0 and the app imports it (`plants.soil_ph_min`, `soil_ph_max`), but
nothing compared it with a bed.

Labs differ in extraction method and units, and lime or fertilizer rates
depend on texture and buffer pH. The app cannot turn a raw number into a
rate without regional data it does not have yet.

## Decision

1. **A test belongs to a bed.** Table `garden_bed_soil_tests` (migration
   0015): date tested, lab, pH, organic matter %, nitrogen, phosphorus and
   potassium as the level the lab reported (low, medium, high), and the lab's
   recommendations as written. Every result is optional, but a test needs at
   least one. Deleting a bed deletes its tests. A test cannot be dated in the
   future (a day of slack for time zones ahead of UTC).
2. **The latest test speaks for the bed:** the latest date, then the latest
   entered, so re-entering a corrected test for the same date replaces the
   first in effect. Older tests are kept as the bed's history; the app shows
   only the latest for now.
3. **API.** `POST /gardens/:id/beds/:bedId/soil-tests` records one;
   `DELETE …/soil-tests/:testId` removes one entered by mistake and answers
   with the bed's latest test now. Members who can change beds can do both;
   viewers cannot. The plan (`GET /gardens/:id/layout`) carries each bed's
   latest test and each planting's crop pH range, so the advice needs no
   extra request.
4. **Advice, never a block** (`garden-layout`, `soil-advice.ts`):
   - On the plan, a plant in a bed whose tested pH is outside its crop's range
     gets a note: "Tomato needs pH 6.0–7.0; this bed tested 7.2: lower it with
     sulfur over a season" (or "raise it with lime"). Direction only, no rate.
   - In the bed's panel: organic matter below 3% suggests compost; a nutrient
     reported low points to the lab's recommendation (or the lab or extension
     office when there is none); a test three or more years old asks for a new
     one, since extension services advise every 2–3 years.
5. **Online only.** A lab report is entered once, at a desk; the form needs
   the server rather than the offline queue.

## Consequences

- Soil tests live in `seasonal-plantings` (`SoilTestService`, next to beds)
  and the data library; no new library for a table and two endpoints.
- No application rates until the dataset carries them (roadmap: amendment
  advice from dataset v0.4); the lab's recommendation is shown as written.
- Viewers see the pH notes on the plan but not the bed panel, which only
  editors open. A read-only view of a bed's soil can come with the bed page.
- The report PDF, a bed's test history, and soil by location (before any
  test) are later slices.
