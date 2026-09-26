# Data model: Garden View Clarity

**Feature**: `014-garden-view-clarity` | **Date**: 2026-09-12

No new PostgreSQL tables or columns. Gardens, memberships, beds, plantings, and sessions are unchanged. This feature defines **view** entities.

## Garden destination

Where a member is inside one garden.

| Destination | What it shows | Notes |
|-------------|----------------|--------|
| Visual garden (Overview) | All beds and areas on the map; bed **name** and **size** on the drawing; planting **names and counts** per occupied bed | Default after open from the list |
| In-bed planting view | One bed’s marks; truncated common name **on** each mark; full name off-plan when selected | Bed **name** in heading / you-are-here only; **no size** |
| Configuration | Name, notes, hardiness, frost, members, invite, leave, delete | Same fields and role rules as today’s garden detail |
| Plantings / calendar / reminders / transplants | Existing pages | Must still reach Overview in one nav action |

Opening `/gardens/:id` is the visual garden (redirect to Overview). It is **not** configuration.

## Planting mark label (derived)

| Field | Rules |
|-------|--------|
| Source | Existing planting common name (catalog / planting record). Not a stored nickname. |
| On-mark text | Prefix of that name, truncated to fit the mark radius. Same prefix for two plantings with the same name. |
| Full name | Unchanged stored name; shown on the off-plan detail line when that mark is selected. |
| Overview | Still name + count **on the bed**, not on in-bed positions. |

**Forbidden**: initials-only codes; a second full-name label beside the mark in Bed View; drawing in-bed positions on Overview.

## Garden configuration (relocated, not new)

Same attributes as today: `name`, `notes`, `hardinessZone`, `lastFrost`, `firstFrost`, membership list, invite, leave, delete. AuthZ unchanged (collaborators may PATCH garden facts; invite / role / delete remain owner-only).

## Selection state (session UI only)

| Field | Rules |
|-------|--------|
| Selected planting | At most one mark in Bed View. Drives the off-plan full-name line. Not persisted. |
| Clear | Click empty plan (not a mark). Select another mark switches. Leaving Bed View discards it (no new draft rule). |

## Access

Unchanged: member-only gardens; non-member not-found; viewers read map, marks, and configuration including the member list; viewers cannot save, invite, delete, or move plantings.
