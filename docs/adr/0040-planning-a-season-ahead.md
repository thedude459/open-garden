# ADR 0040: Planning a season ahead, and planned or planted

## Status

Accepted.

## Context

The product has to help a household plan a garden, see it, and maintain it
across years (principle VIII). Today the three halves of that do not meet:

- **The calendar is a separate list.** Adding a crop to the calendar (the
  welcome page's "Pick a few crops", or the Calendar page) writes a
  `garden_calendar_entries` row: one per crop, which shows the crop's sowing
  windows and nothing else. ADR 0006 kept calendar entries and plantings
  apart on purpose ("no auto-convert"). So the crops a new household picks
  never reach the plan: Bed View does not offer them, and the member has to
  search the catalog again.
- **Only one season is open.** A planting belongs to its property's open
  season (`garden_seasons`); closing it opens the next year, and Plant again
  copies the year's annuals forward. There is no way to lay out next year's
  beds while this year's are still growing, which is when a household plans
  (the seed catalogs arrive in winter; the beds are still full in autumn).
- **One date means two things.** `plantedOn` is both "we plan to sow this on
  May 1" and "we sowed this on May 1". ADR 0037 tells them apart by guessing:
  a planting dated more than a day after it was recorded was planned ahead
  and gets a Sow task. Marking that task done does not record when it was
  really sown, and watering, weather alerts, and harvest timing start from
  the planned date whether or not anything went in the ground.

## Decision

1. **A planting is planned or planted.** A new nullable column, `planned_on`
   (migration), holds the date the household means to sow or plant out.
   `planted_on` holds only the date it really happened, and stays empty until
   a member confirms it.
   - A planting with no `planted_on` is **planned**. On the plan it is drawn
     as an outline (the crop icon, faded, with a dashed ring), so a bed shows
     what is growing and what is coming. Spacing and the area check
     (principle VIII) apply to planned plantings too: planning is where they
     help most.
   - **Mark planted** (on the planting, in Bed View, and as the way to finish
     a Sow task) asks for the date, today by default, and sets `planted_on`.
     The Sow task is due on `planned_on` and closes when the planting is
     marked planted; it replaces ADR 0037's "more than a day after it was
     recorded" guess.
   - Watering (ADR 0035), weather alerts (ADR 0032), fertilizing, harvest
     timing, and the harvest log count only planted plantings. A planned
     planting has one task: its Sow task.
   - Recording a planting with a past or today's date, the usual "I sowed
     this", sets `planted_on` directly, as today.
   - Migration: a planting whose `planted_on` is after today and more than a
     day after it was created (ADR 0037's planned-ahead rule) moves that date
     to `planned_on` and becomes planned. Every other planting stays planted.
2. **The next season can be planned while this one grows.** The Plan,
   Plantings, and Calendar take a season: the current one, or the next year
   (shown as "2027 · planning"). Beds, areas, and walkways are the property's
   and appear in both. An annual belongs to one season; a perennial or tree
   (`life`) appears in every season from the one it was planted in, as
   today. A planting added while the next season is shown belongs to it and
   is planned. Closing the current season makes the planned season current,
   with its plan already in place, and Plant again copies into it as planned
   plantings. Only one season ahead: a household plans next year, not five.
3. **Picking a crop for the calendar adds a planned planting.** The welcome
   page's crops and the Calendar's Add create a planned planting in the
   season shown, with no bed and no date. The calendar page keeps one row per
   crop with its windows, as today, but builds it from the season's plantings
   (five lettuce sowings are one Lettuce row), and suggests a planting's
   planned date from the window. Bed View's panel lists a season's planned plantings that
   are not in a bed, beside waiting transplants, so they can be dragged in
   without searching the catalog. `garden_calendar_entries` is retired: a
   migration turns each entry into a planned planting in the open season,
   unless that crop already has a planting there. This supersedes ADR 0006's
   point 3 for the calendar; favorites stay separate.

## Consequences

- One list of what a household grows, planned or planted, instead of two
  that had to stay labelled apart (ADR 0006's main cost).
- What a separate calendar list gave, and where it goes: "when could I sow
  this here?" is on each plant's page; "we grow these every year" is Plant
  again into the next season; a household's shared list of crops to grow is
  its undated planned plantings. A wishlist tied to no season is not kept;
  per-property favorites would be the place for one if households ask.
- Tasks and weather advice follow what is in the ground, not what was
  hoped for; a planned sowing that never happens stays a planned planting
  with an overdue Sow task, which the member marks planted or removes.
- `planted_on` gains a meaning it lacked: the reminders' and the harvest
  totals' history becomes trustworthy year to year.
- A planned planting with no date has no Sow task; the calendar shows it
  with its window until it is dated.
- Every query that reads plantings for care (reminders, Today, watering,
  alerts) gains a `planted_on is not null` filter; the planner and lists gain
  a season parameter.
- Offline: planned plantings queue like any planting; Mark planted queues as
  a planting edit.

### Built in three pull requests

1. Planned or planted: `planned_on`, the migration, Mark planted, Sow tasks
   from `planned_on`, care tasks only for planted plantings, outlined marks.
2. The next season: the season selector on Plan, Plantings, and Calendar;
   closing a season makes the planned one current; Plant again into it.
3. Calendar picks as planned plantings: the welcome page and Calendar add
   planned plantings, Bed View lists the unplaced ones, and the calendar
   entries migrate and their table is dropped.

## Alternatives considered

- **A separate planning mode or draft layout** that is later "applied".
  Two copies of the plan drift, and applying one is a bulk edit with its own
  conflicts. A planned planting is already a draft of one row.
- **A status column** (`planned`, `planted`, `harvested`) instead of a second
  date. The household needs the planned date anyway for the Sow task and the
  calendar, and `planted_on` being set already says planted; a status would
  repeat what the dates say.
- **Keeping calendar entries** and adding "Plant this" to turn one into a
  planting. That keeps two lists and the step the welcome page skipped.
