# UI contract (Playwright)

**Feature**: `009-ui-feedback-polish`

Accessible names. Planner names from 008 (`Save layout`, `Unsaved changes`, `Back to overview`, `Drop missed a bed`, `Create bed`, `Direct seed`, `Garden plan`, `Bed plan`) stay valid.

## Shared notice

| Role / name | Notes |
|-------------|--------|
| `Notification` | Region showing the current notice |
| notice text | Exact action copy or **Drop missed a bed** |
| `Dismiss` | Present for `error` and `miss` only; MUST NOT appear on success |

Success notice MAY disappear before a later assertion; tests that need it should assert visibility immediately after the action, not after a long wait. Error/miss MUST remain until Dismiss or a replacing notice of any kind.

## Busy

Triggering control: `aria-busy="true"` while in flight; not clickable. After finish, `aria-busy` is not true.

Double-activate **Create garden** or **Save layout** within one second: a single garden / a single PUT (one network attempt).

## Place marker

`You are here` navigation.

| View | Contains |
|------|----------|
| Overview | garden name, `Garden Overview` |
| Bed View | garden name, bed name |
| Transplant View | garden name, `Transplants` |

`Back to overview` still present on Bed View (008).

## Open bed

| Role / name | Who |
|-------------|-----|
| `Open bed {bedName}` | members (rail or equivalent labeled control) |

Click bed body without drag still opens Bed View. Drag bed (owner/collaborator) still moves; must not navigate.

## Bed vs area

Plan: `[data-kind="bed"]` and `[data-kind="area"]`. Visible **Bed** (or `Bed ·`) on beds and **Area** on non-planting areas (in addition to names). Areas MUST NOT open Bed View.

## Empty states

| View | Owner/collaborator | Viewer |
|------|--------------------|--------|
| Gardens list, 0 gardens | Next step uses **Create garden** | N/A (they can still create their own gardens; list empty is per user) |
| Overview, 0 beds | **Create bed** | Empty copy; no Create bed |
| Bed View, 0 plantings | **Direct seed** and **Transplants** both present, same button rank | Empty copy; neither edit control |

## Buttons

Primary / secondary / destructive are CSS ranks (`.btn-primary` etc.). Playwright continues to use accessible **names**, not CSS classes, except visual review (SC-007) which is manual.

## In scope for e2e (009 specs)

- Auth + gardens list + catalog search/add: `ui-feedback-auth.spec.ts`
- Save layout, offline Save, Add transplant, miss `role="alert"`: `ui-feedback-planner.spec.ts`
- Place marker, keyboard **Open bed {name}**, 390px **Open bed** / **Back to overview**: `ui-place-marker.spec.ts`

## Out of scope for e2e

SC-001 0.5s timing; SC-004/005/006 participant studies; SC-007 visual token review (T036 is accessible-name smoke only).
Garden home/forms busy (Save garden, invite, Delete garden) — implement T016; verify in quickstart.
Plantings list, calendar, reminders action-by-action busy audit.
