# ADR 0037: Succession planting and Sow tasks

## Status

Accepted. [ADR 0040](0040-planning-a-season-ahead.md) replaces the Sow task's
"planned ahead" guess with a planned date, and a Sow task closes when the
planting is marked planted.

## Context

Phase 4 item 7 asks for succession planting: "every 2 weeks until <date>"
creates a series, so a household sows lettuce or radishes a little at a time
instead of all at once. A planting already holds one crop's sow date, start
method, bed, and season (principle VIII), and reminders already cover
watering, fertilizing, and harvest. Nothing told a member when to sow a
planting dated in the future, so a series would sit in the list unannounced.

## Decision

1. **A series is copies of one planting.** In a planting's editor, once it
   has a sow date and is an annual, **Repeat sowing** takes "every N weeks
   (1–12) until a date". `POST …/plantings/:id/repeat` adds one planting per
   step after the original's sow date, up to and including that date, in the
   original's season. Each copy keeps the crop, start method, and life; a
   transplant's indoor start moves by the same number of days. Copies start
   without a bed or tray: the member places each when it is sown, and the
   area check (principle VIII) runs then, as for any planting. At most 26
   copies; more, or none fitting before the date, is refused with a reason.
   There is no series record: each copy is an ordinary planting, edited or
   removed on its own. Repeating needs a connection; it is not queued offline.
2. **Only dates the crop can use.** Extension guidance agrees on two
   limits for succession sowing, and the app already holds the data for both:
   - **Sowing windows.** Cool-season crops bolt in summer heat; the advice is
     to stop sowing them in the hottest weeks and resume in late summer for
     fall. A series keeps only dates inside the crop's windows at the
     property for that season: its spring sowing window (or planting-out
     window for a transplant) and its fall sowing window (ADR 0025's
     temperature windows where frost is rare). With no windows known, every
     date is kept.
   - **Last useful sowing.** Count back from the average first frost by the
     days to maturity plus about two weeks for slow growth in cool, short
     fall days, and two weeks more for a crop frost kills (Virginia
     Cooperative Extension's "fall factor"; beans, squash, and cucumbers are
     its examples). A crop with a fall sowing window in the dataset is hardy
     enough to grow on through light frosts, so the end of that window is its
     last sowing instead; counting back would cut lettuce's curated fall
     window entirely.
   - The reply says how many dates were left out for each reason, and the
     editor offers the last useful sowing as the series' end
     (`GET …/plantings/:id/repeat`).
3. **Sow tasks.** A new care kind, `sow` (migration 0017 widens the care
   events' check constraint). A planting whose sow date is more than one day
   after the day it was recorded was planned ahead and gets a Sow task due on
   that date, upcoming before it and overdue after, until it is marked done
   (or the planting is harvested). This covers every planting dated ahead,
   not only series copies, and reaches Today, the task list, and the push and
   email reminders through the existing paths. Plantings recorded on or after
   their sow date — the usual "I sowed this" — get none, so existing data
   gains no tasks.
   - The one-day margin absorbs the gap between the server's record date
     (UTC) and the member's local sow date. A sowing planned for the next day
     gets no task; that is a known, accepted ceiling.
   - Watering for a planned planting still starts from its sow date, as for
     any planting.

Sources (read through search results; the extension sites are outside this
environment's network allowlist): University of Georgia, Maryland, West
Virginia, Kentucky (Franklin County; ID-128), Florida IFAS, Missouri, UConn,
and Vermont extension pages on succession planting; Virginia Cooperative
Extension on fall gardens; Virginia Tech on leafy greens.

## Consequences

- Undoing a series means removing its copies one by one. A grouped series
  (rename, shift, or delete all) would need a series record; add one only if
  households ask.
- Marking a Sow task done does not change the planting's sow date; a member
  who sowed on another day edits the date.
- The interval is the member's choice (two weeks by default, the most common
  extension advice). Per-crop intervals (7 days for radish and leaf lettuce,
  10 for bush beans, 21 for carrots in Kentucky's table) would come from the
  dataset; that table credits Johnny's Seeds, so the values need an open
  source first.
- Copies are unplaced, so Bed View does not show them until placed; Plantings
  lists them, and the calendar shows the crop as planted.
