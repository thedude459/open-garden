# ADR 0026: Dates in the browser's language and region

## Status

Accepted

## Context

The calendar wrote sowing windows with hard-coded English month
abbreviations, and Reminders, Transplants, Plantings, and property Settings
showed stored days as `2026-05-01`. Households outside the US read
"1 May" or "1. Mai", not "May 1" or an ISO date.

## Decision

1. **The browser decides.** Dates follow the browser's language and region
   through the platform's `Intl.DateTimeFormat`. There is no setting and no
   i18n library; a member who wants another format changes their browser
   language, as for every other site.
2. **One helper.** `formatDay` (a stored day with its year) and
   `formatMonthDay` (a window edge with no year) in `libs/web-ui` are the
   only date formatters the web app uses. Stored days are calendar days, so
   both format in UTC and a day never shifts with the time zone.
3. **Browser tests pin `en-US`.** `signedInPage` creates its context with
   `en-US` unless a test passes another locale, so date assertions do not
   depend on the machine running them.

## Consequences

+ Month names and day order follow the reader without new UI or storage.
- Only dates are localized. The interface itself stays in English; crop
  names in other languages need translated names in the dataset first.
- A shared screen shows dates in each viewer's own format.
