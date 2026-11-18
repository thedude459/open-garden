# Changelog

What each release of Open Garden changes, for the households who use it and
the people who run it. Every pull request adds a line to **Unreleased**, under
the heading it belongs to (a CI check asks for it; see
[CONTRIBUTING](CONTRIBUTING.md#releasing)). The Release workflow publishes a
version's entry as its release notes.

Headings, in this order (leave one empty when nothing belongs there):

- **Summary**: one or two sentences on what matters most. Written when the
  release is cut.
- **New features**, **Improvements**, **Bug fixes**: one line per change, in
  plain words, for households first.
- **Security**: every publicly known vulnerability in Open Garden's own code
  (with a CVE or GitHub security advisory id) that this release fixes. Not
  dependency updates.
- **Known issues**: defects still to fix, with their issue.
- **Deprecated features**: what a later release will remove.

## Unreleased

### Summary

Areas, watering by water balance, weather alerts, soil tests, succession
planting, harvest totals, and accounts you can manage yourself, on a climate
worked out anywhere in the world. Database changes apply on their own when
the API starts; back up first, as always.

### New features

- **Climate anywhere:** hardiness zone, frost dates (median and 1-in-10), and
  monthly temperatures come from 30 years of Open-Meteo history, with NASA
  POWER as a second source; Southern Hemisphere seasons and frost-free places
  (sowing by temperature) are supported.
- **Metric or imperial**, per member, for lengths, temperatures, and harvest
  weights; dates follow the browser's language and region.
- **Today** is the home page: overdue and due tasks across properties, what
  to start this week, and weather alerts.
- **Plan by area:** a property's vegetable garden, orchard, bramble patch,
  and greenhouse are areas you can rename, delete when empty, and move beds
  between; each is outlined on the plan, and every member can read them.
- **The plan saves itself** a moment after each change, with Undo; it opens
  fitted to your beds and remembers its zoom.
- **Plantings list** with an editor per planting; the calendar follows what
  you planted.
- **Succession planting:** repeat a sowing every few weeks until a date; only
  dates in the crop's sowing windows, and early enough to ripen before frost,
  are added. Plantings dated ahead get **Sow** tasks.
- **Harvest totals:** record a weight or a count for each harvest; the
  Harvests tab totals each crop for a season.
- **Watering by water balance:** plants in beds are watered when the soil is
  about 25 mm (1 in) short, from evapotranspiration, rain, the crop's stage,
  and the bed's sun and mulch.
- **Weather alerts** for frost and heat ahead, for the plants in your beds.
- **Soil tests** per area or bed, with pH advice for what grows there.
- **Reminders by web push and email**, once a day.
- **Companion advice** from the open-garden-data dataset, in the planner and
  on plant pages.
- **Crop rotation hints** when a bed held the same family last year.
- **Plant catalog:** the open-garden-data dataset is the catalog; filter by
  family and by what can be sown this week at a property; crop icons; each
  plant page shows when to sow at your property, its varieties, soil pH, and
  crop coefficients.
- **Guided setup** for a household's first property.
- **Account page:** change your password (other devices are signed out),
  delete your account, and reset a forgotten password by email or by a link
  from whoever runs the server (`docker compose exec api node dist/reset-link.js <email>`).

### Improvements

- Property cards draw a small plan of each property and name its next task.
- Settings are split into sections; the climate can be filled in again from
  the address.
- An ended session sends you to sign-in, then back to where you were, instead
  of showing empty pages.
- The Plants page shows the whole catalog, 100 at a time, with Show more.
- Every main page passes an automated accessibility scan; plants can be
  placed with the keyboard.
- The first page loads less code; sign-in attempts are rate limited per
  address and per IP, and expired sessions are cleaned up.
- A tree's bed is sized by its rootstock; a bramble patch takes cane fruit.
- A new brand mark: a seedling in a raised bed.

### Bug fixes

- Dragging catalog plants and transplants onto a bed places them again.
- Tray seedlings can be planted out from Bed View, and no longer vanish from
  its waiting transplants.
- A Save garden click is no longer lost.
- Southern Hemisphere frost dates are kept, and windows across 29 February or
  the year end land on the right day.
- A failed sync shows the server's reason instead of a generic message.

### Security

### Known issues

- Rate limits for sign-in and password changes are kept in the API process,
  so a restart clears them.
- A sowing planned for the next day gets no Sow task (ADR 0037).
- Soil tests, harvest amounts, and succession series need a connection; they
  are not queued offline.

### Deprecated features

## v0.1.0 (2026-11-08)

### Summary

The first published release of Open Garden: a self-hosted garden planner for
households, installed with Docker. Plan beds on a scaled property map, record
plantings by season, get sowing and transplant windows from frost dates and
care reminders with a rain outlook, and share a garden with your household.

### New features

- Properties on a map with beds drawn to scale, plantings by season, a
  planting calendar from frost dates, care reminders, and shared households
  with owner, collaborator, and viewer roles.
- Multi-arch images on ghcr.io with an SBOM and signed build provenance;
  database migrations tracked and applied once on start.

### Security

### Known issues

### Deprecated features
