# ADR 0011: Client notice queue and visual tokens

## Status

Accepted

## Context

Garden Planner UX (008) made Overview, Bed View, and Transplant View work, but
waiting actions often finished silently and beds vs non-planting areas relied
on fill color. Spec 009 asks for immediate busy/confirm, a place marker, empty
next steps, and one spacing/elevation/button language — without new REST
resources or a toast vendor.

## Decision

1. **`libs/web-ui`**: pure `createNoticeQueue` (success expires 4000 ms, no
   Dismiss; error/miss until Dismiss; any kind replaces current) and
   `createBusyLock` (`tryBegin` / `end`). Angular `NoticeService` +
   `NoticeHost` (`Notification`) wrap them. Clear the queue on navigation.
2. **Tokens** in existing `apps/web/src/styles.css`: `--space-1`–`--space-6`,
   `--elev-1`/`--elev-2`, `.card`, `.btn-primary` / `.btn-secondary` /
   `.btn-destructive`, `.empty-state`. No design-system package.
3. **No backend**: notices and busy keys are in-memory. Membership, layout
   draft-until-Save, and drop-missed-a-bed copy stay as in 008/0010.
4. Plantings list, calendar, and reminders inherit `.btn` appearance only.

## Consequences

+ Vitest coverage includes `libs/web-ui` for the 80% gate.
+ Playwright asserts accessible names, not CSS.
- Garden name for the place marker is loaded from the existing garden detail
  GET (layout DTO has no name field).
