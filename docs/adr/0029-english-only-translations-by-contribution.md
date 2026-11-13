# ADR 0029: English only; other languages come from contributors

## Status

Accepted. Supersedes [ADR 0026](0026-dates-in-the-browser-locale.md).

## Context

ADR 0026 wrote dates in the browser's language, so a German browser saw
"18. Feb." inside English buttons and messages: half a translation. The
maintainer wants the app in one language until people who speak another
contribute a translation, and the code ready for that when it comes.

## Decision

1. **English everywhere for now.** The interface, dates, month names, crop
   names, reminder emails, and server-written text (Today task titles) are
   US English, whatever the browser's language.
2. **One switch for the language.** `APP_LOCALE` in `libs/web-ui` (`en-US`)
   is the only place the web app names a language. Dates and month names go
   through `formatDay`, `formatMonthDay`, and `formatMonthName`, which take
   it as their default, so a translation changes them in one place.
3. **Translations are contributions.** A language is added by someone who
   speaks it, reviewed in a pull request, as `CONTRIBUTING.md` describes. The
   first one sets up Angular's built-in i18n (`@angular/localize`): mark the
   interface's text, extract it, and build one app per language with its
   locale. Server-written text and emails then follow the request's
   language. Crop names in other languages come from the dataset's
   `names.<locale>`, which already allows them and accepts them as
   contributions there.

## Consequences

+ One language that reads consistently, and no translations to keep up with
  until someone offers one.
+ Dates and month names already go through one locale, and the dataset
  already holds per-language names.
- Interface text is not marked for translation yet; the first contributor
  does that once, with the maintainer's review.
