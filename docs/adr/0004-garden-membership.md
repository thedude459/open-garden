# ADR 0004: Garden membership roles vs account roles

## Status
Accepted

## Context

Open Garden already has `users.role` of `user` | `admin` (admin may trigger
catalog sync). Household gardens must be shareable with owner / collaborator /
viewer permissions without making every garden owner a product admin, and
without a single global “gardener” flag that would share all gardens at once.

## Decision

Keep account `users.role` for operator capabilities. Represent garden access as
`garden_memberships` rows (`owner` | `collaborator` | `viewer`) plus
`gardens.owner_id` for owner-scoped name uniqueness. Session auth still gates
all garden APIs; a membership check scopes each garden id.

## Consequences

+ Sharing one garden does not grant catalog-sync admin
+ Isolation tests are straightforward (membership join)
+ Transfer of ownership is an explicit membership + `owner_id` update
- Two role vocabularies (`users.role` vs garden role) must stay documented
- Invite requires an existing user row (no email identity provider)
