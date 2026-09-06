# Data model: UI Feedback & Garden Usability Polish

**Feature**: `009-ui-feedback-polish` | **Date**: 2026-08-22

No PostgreSQL tables, columns, or IndexedDB stores. Membership, gardens, beds, areas, plantings, and layout draft stay as in 002–008.

## Client presentation state

### Notice

In-memory, at most one current notice.

| Field | Rules |
|-------|--------|
| id | Opaque string; new id on each post |
| kind | `success` \| `error` \| `miss` |
| message | Non-empty trimmed text; success/error copy from the action; miss uses **Drop missed a bed** when that is the miss |
| dismissible | `true` for `error` and `miss` (Dismiss shown); `false` for `success` (auto-dismiss only, no Dismiss) |
| expiresAt | Set for `success` (now + 4000 ms); null for `error`/`miss` |

**Transitions**: empty → posted → replaced (a newer post of any kind replaces the current notice) or dismissed or expired (success only) or cleared on navigation.

**Validation**: Empty message MUST NOT post. Unknown kind MUST NOT post.

### Busy lock

| Field | Rules |
|-------|--------|
| keys | Set of in-flight action keys (e.g. `save-layout`) |

**Transitions**: `tryBegin(key)` no-op/false if key present; `end(key)` removes. `end` on a missing key is a no-op.

### Place marker

Derived from route + already-loaded garden/bed names. Not persisted.

| Field | Rules |
|-------|--------|
| gardenName | From current garden |
| level | `overview` \| `bed` \| `transplants` |
| bedName | Required when level is `bed` |

### Empty state

Not stored. Derived: zero gardens; zero drawable beds on Overview; zero plantings in the open bed; zero catalog hits.

## Relationships

- Notice and busy lock are global to the signed-in PWA session (one host in `AppComponent` or a root overlay). They MUST NOT contain other members’ private data beyond what the current screen already shows.
- Place marker reads the same garden/layout DTOs as 008; no extra fetch required beyond what the page already loads.

## AuthZ (unchanged)

Owner/collaborator: mutate controls may be busy. Viewer: no mutate busy; Open bed and empty explanations still shown. Non-member: existing not-found.
