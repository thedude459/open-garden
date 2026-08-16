# ADR 0005: Planting calendar window math

## Status
Accepted

## Context
The planting calendar must turn a garden’s annual last/first frost (month+day,
no year) and optional catalog frost-relative weeks into indoor-start, sow,
transplant, and harvest **date ranges**. Clarify session 2026-08-16: ranges not
single days; each start window is last- or first-frost relative as the catalog
says; harvest is start window plus days to maturity; “this week” is local today
through today+6; ranges are not clipped to frost dates.

## Decision
1. Persist guidance as signed week offsets plus a frost anchor on `plants`, not
   as computed dates on calendar entries.
2. Compute ranges in domain lib `libs/planting-calendar` using reference year
   2024 (leap-safe, including Feb 29), then store results as annual `MonthDay`
   plus `wrapsYear`.
3. Recompute on every GET from current garden frost dates.
4. Compute this-week overlap in the same lib but **invoke it on the client**
   with the viewer’s local date. The API does not send `emphasized`.

## Consequences
+ Frost-date edits update windows without rewriting entries
+ Unit tests cover SC-002 / SC-008 without HTTP or timezones
+ Provider-null guidance stays unavailable (no invented weeks)
- Clients must run overlap themselves (shared helper, not duplicated formulas)
- Reference year 2024 is an implementation detail; users still see month+day
