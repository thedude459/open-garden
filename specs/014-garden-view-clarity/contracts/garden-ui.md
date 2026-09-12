# Garden UI contract

**Feature**: `014-garden-view-clarity`

Product REST is unchanged (gardens, members, layout, plantings). This is the **gardener-facing destination** contract.

## Destinations

| Path | Role | Primary content |
|------|------|-----------------|
| `/gardens` | List | Create / pick a garden |
| `/gardens/:id` | Redirect | **Must** land on the visual garden (`/gardens/:id/layout`) |
| `/gardens/:id/layout` | Visual garden | Overview map. Bed name **and** size on the plan. Occupied beds: planting names (and counts). **Must not** show the configuration form, member list, or delete as the main body. |
| `/gardens/:id/layout/beds/:bedId` | In-bed view | Planting marks with truncated names **on** the mark. **Must not** paint bed name or size on the bed drawing. Full common name in **one** status/detail line off the plan when a mark is selected. |
| `/gardens/:id/configure` | Configuration | Name, notes, zone, frost, members, invite, leave, delete garden (existing role rules). |
| `/gardens/:id/plantings` etc. | Unchanged pages | Garden nav **must** include a one-click Overview (visual garden). |

## Navigation

Garden destinations except Bed View **must** expose a Garden nav that includes **Garden Overview** and **Configuration** (plus existing Plantings, Calendar, Reminders, Transplants).

- List row for a garden → Overview (not Configuration).
- Place marker “garden home” → Overview.
- Bed View → Overview in one action (existing Back to overview is enough).

## Labels

| View | On the drawing |
|------|----------------|
| Overview | `Bed · {name} · {size}`; area name and size; planting name × count on the bed. **No** planting circles or beside-mark names |
| Bed View | Circle + truncated common name **inside / on** the mark. No `Bed ·` size caption. No separate full-name text beside the mark. |

Selecting a mark: `role="status"` (or equivalent live region) shows the **full** common name. Clicking another mark updates the line. Clicking empty plan clears it. Assistive name of the mark may remain the full name.

## AuthZ (unchanged, relocated)

| Action | Owner | Collaborator | Viewer |
|--------|-------|--------------|--------|
| See map / marks / configuration | yes | yes | yes |
| PATCH garden facts | yes | yes | no |
| Invite / change role / remove / delete garden | yes | no | no |
| Move plantings / save layout | yes | yes | no |

## Out of contract

New REST resources, stored nicknames, changing Overview vs Bed View edit split, drawing in-bed positions on Overview, CI-on-Compose-app-profile.
