# ADR 0010: Two-view planner, start method, and non-planting areas

## Status

Accepted

## Context

ADR 0009 made the layout page a single canvas with a client draft over
`GET/PUT /layout`. Spec 008 (2026-08-21) splits **bed geometry** (Overview)
from **in-bed plantings** (Bed View), adds **non-planting areas**, and
introduces **direct seed vs transplant**. The indoor tray is only unplaced
transplants; Transplant View creates/deletes those records and shows indoor
water/fertilizer tasks. ADR 0009’s “no new tables” and “one plan canvas”
no longer hold.

## Decision

1. **Three routes**, one garden, shared in-memory **layout draft**:
   `/gardens/:id/layout` (Overview), `/gardens/:id/layout/beds/:bedId`
   (Bed View), `/gardens/:id/transplants` (Transplant View). Navigating among
   them MUST NOT discard the draft. Leaving the planner or reload discards it.
2. **Persist** `garden_non_planting_areas` and planting `start_method` +
   `indoor_started_on` (migration `0008`). Layout GET/PUT includes `areas`.
   Area create/move/resize is draft-until-Save (upsert on PUT). Confirmed
   area delete is immediate `DELETE` (like beds).
3. **Transplant create/full-delete** is an immediate planting-record write
   (004 POST/DELETE), not the layout draft. Unplaced transplants
   (`start_method = transplant`, no placement) fill the Bed View tray.
4. **Direct seed** is a layout-draft planting (client UUID) until Save, then
   POST planting + PUT placement. Remove from bed deletes that planting
   (confirm). Remove transplant from bed restores it to the tray (same row,
   information kept) on the draft until Save.
5. **Indoor tasks**: `deriveIndoorReminders` in `libs/care-reminders` using
   `indoor_started_on` and catalog intervals, **only** for unplaced
   transplants. Complete/dismiss reuses `POST` care events. Direct seed never
   gets indoor tasks. In-ground 006 reminders stay on `planted_on`.
6. Keep Pointer Events, transform pan/zoom, gesture-end `evaluateLayout`,
   IndexedDB last successful GET only, membership AuthZ (ADR 0004/0007/0009).
   Save orchestration lives in `apps/web/src/app/gardens/planner-save.ts`
   (evaluate → POST beds → POST direct seeds → PUT layout → DELETE pending
   direct seeds; compensating DELETE of new beds and new direct-seed plantings
   if PUT fails). Overview and Bed View share `PlannerDraftService`.

ADR 0009 remains in force for draft Save orchestration of **beds**,
compensating DELETE of POSTed beds **and** new direct-seed plantings on PUT
failure, and unknown-spacing visual radius 6. Leftover unsized beds are
**deleted** in migration `0008` (not drawn and not sized).

## Consequences

+ Matches the two-view spec and indoor vs in-ground care split
+ Areas do not need name-only POST (always sized)
- Bed DELETE must treat direct seed vs transplant differently
- Layout DTO grows `areas` and planting `startMethod`
- Indoor derivation is a second entry point beside `deriveReminders`
