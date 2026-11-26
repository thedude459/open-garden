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
- **Documentation**: new or changed guides, install and upgrade steps,
  settings references, and ADRs worth reading.
- **Security**: every publicly known vulnerability in Open Garden's own code
  (with a CVE or GitHub security advisory id) that this release fixes. Not
  dependency updates.
- **Known issues**: defects still to fix, with their issue.
- **Deprecated features**: what a later release will remove.

## Unreleased

### Summary


### New features

- **17 more fruits and nuts** from plant catalog v0.3.1 for fruit gardens:
  apricot, plum, nectarine, sour cherry, almond, Asian pear, pawpaw, and
  American persimmon trees; fig, hazelnut, red currant, gooseberry,
  elderberry, haskap, and aronia bushes; and grape and hardy kiwi vines,
  each with its icon, most with soil pH and varieties. Strawberries,
  raspberries, and blackberries now warn against tomatoes, potatoes,
  eggplant, and peppers (Verticillium wilt). The API imports the catalog
  when it starts.
- **32 more vegetables and herbs** from plant catalog v0.3.0, among them
  kohlrabi, turnip, collards, arugula, bok choy, napa cabbage, tomatillo,
  peanut, fava bean, shallot, lavender, rosemary, sage, and chamomile, each
  with its icon. Most water by water balance. The API imports the catalog
  when it starts.
- **Plan for a date from the Calendar:** a crop picked for the season with
  no date gets a **Plan for …** button with the next day it can be sown
  there (today while its window is open), which gives it a Sow task.

### Improvements

- The first page downloads about 21 KB less (19%): the planner's code now
  loads when a plan is opened, and the unused zone.js library is gone.
- Operators: the API reports unhealthy when it cannot reach the database,
  stops a query after 30 seconds, no longer sends `X-Powered-By`, and spaces
  address lookups a second apart with a one-hour cache, as Nominatim asks. The
  compose files pin Postgres by digest.
- A new password longer than the 72 bytes bcrypt reads is refused instead of
  being cut short silently, and signing in with an unknown email takes as long
  as with a known one, so its timing does not reveal who has an account.
- The API log shows each request with an id that errors repeat, and a
  `security.` line for sign-ins, lockouts, password changes and resets, account
  deletions, and catalog runs. `LOG_LEVEL` sets how much is logged.
- Error messages say what went wrong more often: the API sends every error in
  one form, and the app no longer shows technical text such as "Http failure
  response" in their place.
- Pages load faster: the `web` container now compresses what it sends
  (a first visit is about 113 kB instead of 408 kB) and lets browsers keep
  the app's code files until a release changes them.
- Online, a plant search always comes from the server, so it no longer
  misses plants past the first saved page. Offline, saved pages still answer.
- Every bed now belongs to an area, and its area alone decides what it
  takes. Beds from before areas join their property's vegetable or fruit
  garden (created if missing) when the API starts.
- **Fruit gardens:** orchards and bramble patches become one area type, the
  fruit garden, for fruit trees, cane fruit, fruit bushes, and grapes and
  kiwis, with herbs or flowers underneath. Existing orchards and bramble
  patches keep their names and beds. **Add fruit row** on the Overview adds
  a row for canes, bushes, or vines; **Add tree** still adds a tree's own
  bed. Vegetable gardens keep taking strawberries, asparagus, and rhubarb,
  and new plantings of those now last past the season.

- **Plant catalog v0.2.3:** twelve more crops water by water balance
  (kale, basil, cilantro, parsley, oregano, thyme, okra, rhubarb, chives,
  leek, Swiss chard, and dill), and borage and calendula get sowing windows
  where frost is rare. The API imports it when it starts.

### Bug fixes

- Creating or renaming a bed with a bad size now says what is wrong, not
  "Bed name is required".
- On a shared device, the next member no longer sees the last one's
  properties. Signing out deletes what the app saved on the device for
  offline use, and so does signing in as a different member after a session
  ended.
- Deleting a bed, saving the plan, and repeating a sowing now save
  completely or not at all. Before, a failure part-way could delete a bed's
  plantings and keep the bed, or save half a plan.
- Stopping or upgrading the app no longer cuts off the API mid-request: it
  finishes what it is doing and closes its database connections first. Compose
  files now run the API with `init: true`.
- A mistyped property, plant, or planting address in a link now shows "not
  found" instead of a server error, and no longer fills the server log.
- Behind an HTTPS proxy, failed sign-ins now count against each visitor's
  own address. Before, every visitor shared one limit, so anyone could lock
  the whole household out of signing in for 15 minutes.
- Bed View's plant search fills its list with plants the bed takes, instead
  of hiding most of a page of ones it refuses.
- Catalog filters such as family find every match again; once the catalog
  passed 100 entries, a filter answered from the first page missed the
  rest (Radish under the Cabbage family).
- A newer open-garden-data release mounted with `PLANT_CATALOG_FILE`
  imports again: releases from v0.2.3 on are signed by the release workflow
  run on `main`, which the catalog check refused.

### Documentation

- [Deployment](docs/deploy.md#logs): reading the API log, and `LOG_LEVEL`.
- [ADR 0043](docs/adr/0043-atomic-writes.md): writes that span rows commit
  together.
- [Deployment](docs/deploy.md#https): which proxies the `web` container
  trusts to name the visitor's address.
- [ADR 0042](docs/adr/0042-fruit-gardens.md): fruit gardens.

### Security


### Known issues


### Deprecated features

## v0.3.0 (2026-11-22)

### Summary

Plan next season while this one grows, and keep what you planned apart from
what you planted: a planting has a planned date until you mark it planted,
and only then do watering, harvest, and weather alerts begin. Crops you pick
on the walkthrough or the Calendar now wait in Bed View, ready to drag onto a
bed. Database changes apply on their own when the API starts; back up first,
as always.

### New features

- **Planned or planted:** a planting has a planned date and, once it is in
  the ground, a planted date. **Mark planted** (in the planting's editor and
  in Bed View), or finishing its Sow task, records the day. Until then it is
  drawn as an outline on the plan and has one task, to sow it; watering,
  feeding, harvest, and weather alerts start once it is planted. Plantings
  already dated in the future become planned when you upgrade.
- **Plan next season while this one grows:** a Season picker on the plan, in
  Bed View, and on Plantings shows this year or next year (planning). Plants
  added to next year's plan belong to it, and its Sow tasks come up on Today;
  beds, areas, perennials, and trees are the same in both. Closing this
  season makes the planned one current, already laid out. Next year's plan
  needs a connection.
- **Crops you pick are ready to place:** picking a crop on the welcome page,
  the Calendar, or with Plant again adds it to the season's plan, and Bed
  View lists it under "Planned, not in a bed" to drag in. The Calendar has
  the Season picker too. Crops already on your calendar become planned
  plantings when you upgrade.

### Improvements

- The web image runs nginx mainline (1.31) instead of stable (1.30), which
  carried six fixed high and critical nginx CVEs; nginx releases security
  fixes to mainline first.
- Release notes start with the Summary under a release titled with the
  version, and have a Documentation section for guide and install changes.
- Bed View shows the soil test that applies to the bed: its own, otherwise
  its area's.
- Watering and frost and heat alerts share one weather request per property
  an hour, instead of two.


### Bug fixes

- Bed View's Place buttons stay inside the plant panel, so plants can be
  dragged onto the bed again; a long name pushed them off the screen (#236).

### Documentation

- ADR 0041: base-image vulnerabilities are found daily on images built from
  `main`, tracked in one issue that names a clean base when there is one,
  and may be skipped only with a tracking issue and an expiry.
- ADR 0040 plans the next season while this one grows, and keeps planned
  and planted dates apart.

### Security


### Known issues

- Next season's plan, plantings, and calendar need a connection; only the
  current season is kept for offline use.
- A crop picked for the season has no planned date, so it gets no Sow task
  until you give it one in its planting's editor.
- Rate limits for sign-in and password changes are kept in the API process,
  so a restart clears them.
- Soil tests, harvest amounts, and succession series need a connection; they
  are not queued offline.

### Deprecated features

## v0.2.0 (2026-11-18)

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
- Release notes follow one layout from this release on, with a Security
  section naming any fixed vulnerability in Open Garden by its CVE or
  advisory id.

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
