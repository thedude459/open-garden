# Feature Specification: Household Gardens

**Feature Branch**: `002-household-gardens`

**Created**: 2026-08-13

**Status**: Implemented

**Input**: User description: "A household can create a named garden, set site conditions, and share it with specific people. Include: Garden as a first-class resource (name, notes). Site profile on the garden: hardiness zone, last/first frost dates (calendar cannot work without this). Membership: owner / collaborator / viewer; invite by existing user email (no SSO). Isolation: members see only gardens they belong to; catalog stays shared reference data; favorites stay private. Offline: previously loaded garden list/detail readable; membership changes online-only for v1. Exclude: bed geometry, planting dates, calendar math, layout canvas."

## Clarifications

### Session 2026-08-13

- Q: When both frost dates are set, how must last frost and first frost relate? → A: Last frost (spring) must be earlier in the calendar year than first frost (fall); same-day and reversed pairs are rejected
- Q: Must garden names be unique? → A: Unique among gardens the user owns; memberships in other people’s same-named gardens are still allowed
- Q: What happens when an owner deletes a garden? → A: Permanent delete after confirm; no undelete in this feature
- Q: How are concurrent online edits to the same garden handled? → A: Last save wins; after save or refresh, the user sees the current stored values (no merge editor)
- Q: What can members see on the garden member list? → A: All members see display name and email for everyone on the garden

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Manage a Named Garden (Priority: P1)

A signed-in gardener creates a garden with a name and optional notes, opens it later from their garden list, and updates name or notes when the household’s plans change. A gardener with no gardens yet sees a clear empty state and can create the first one.

**Why this priority**: A garden is the household’s planning container. Calendar, plantings, and layout all attach to it; without create/list/detail there is nothing to share or profile.

**Independent Test**: Sign in as a user with no gardens, create a named garden, see it on the garden list, open detail, edit the name and notes, and confirm a second signed-in user who was never invited does not see that garden.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no gardens, **When** they open their garden list, **Then** they see a clear empty state and a way to create a garden.
2. **Given** a signed-in user, **When** they create a garden with a non-empty name that they do not already own, **Then** they become its owner and the garden appears on their list with that name.
3. **Given** a user who already owns a garden named “Backyard”, **When** they try to create or rename another owned garden to “Backyard”, **Then** the change is rejected with a clear message; they MAY still be a collaborator or viewer on someone else’s garden also named “Backyard”.
4. **Given** an owner viewing a garden they belong to, **When** they open garden detail, **Then** they see the name, notes (or a clear empty-notes state), and that they are the owner.
5. **Given** an owner (or collaborator) viewing a garden, **When** they change the name and/or notes, **Then** members who next open that garden see the updated values.
6. **Given** User A owns a garden, **When** User B is signed in and was never invited, **Then** User B’s garden list does not include User A’s garden and User B cannot open it by guessing.
7. **Given** a visitor who is not signed in, **When** they attempt to list, create, or open a garden, **Then** they are prompted to sign in and no garden data is shown.
8. **Given** an owner, **When** they choose to delete a garden and confirm, **Then** the garden is permanently gone for all members (not listed, not openable) and cannot be undeleted in this feature; catalog and favorites are unchanged. **When** they start delete but cancel the confirm, **Then** the garden remains.

---

### User Story 2 - Set Garden Site Conditions (Priority: P2)

A gardener records the garden’s hardiness zone and typical last (spring) and first (fall) frost dates so later planning features have a stable site profile. They can save a garden before frost dates are known, then fill them in when they are.

**Why this priority**: Zone and frost dates are the site facts a planting calendar cannot invent. They are not required to prove a garden exists, but they are required for this feature to be a useful foundation.

**Independent Test**: Create or open a garden, set zone and both frost dates, reopen detail and see the same values; clear or omit frost dates and see that they are shown as not set rather than invented.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator editing a garden, **When** they set a hardiness zone in the supported range, **Then** that zone is stored on the garden and shown on detail.
2. **Given** an owner or collaborator editing a garden, **When** they set last-frost and first-frost dates as annual calendar days, **Then** those dates are shown on detail and persist when the garden is reopened.
3. **Given** a garden with no frost dates yet, **When** a member opens detail, **Then** frost dates are clearly marked as not set (not filled with guessed values).
4. **Given** a viewer of a garden, **When** they open detail, **Then** they can read zone and frost dates but cannot change them.
5. **Given** invalid site input (zone outside 1–13, last frost and first frost on the same calendar day, or last frost on or after first frost in the calendar year), **When** the user tries to save, **Then** the save is rejected with a clear message and prior valid values remain.

---

### User Story 3 - Share a Garden by Email and Manage Membership (Priority: P3)

An owner invites an existing signed-up user by email as collaborator or viewer. The invitee immediately sees the garden on their list with the granted role. The owner can change a member’s role or remove them. Collaborators and viewers can leave. Catalog browsing and personal favorites stay unchanged and unshared.

**Why this priority**: Household sharing is a core product expectation and must ship with gardens; a private-only garden would have to be retrofitted. It still depends on a working garden resource from US1.

**Independent Test**: User A creates a garden, invites User B (existing account) as collaborator by email; B sees the garden and can edit name/notes/site profile but cannot invite others or delete; User C sees nothing; A changes B to viewer and B can no longer edit; B leaves or A removes B and B no longer sees the garden.

**Acceptance Scenarios**:

1. **Given** an owner and an existing user whose email is known, **When** the owner invites that email as collaborator or viewer, **Then** the invitee is a member with that role and the garden appears on the invitee’s list without a separate sign-up flow.
2. **Given** an owner, **When** they invite an email that has no account, **Then** they see that the person must already have an account, and no membership is created (no external identity provider or magic-link invite in this feature).
3. **Given** a collaborator, **When** they edit name, notes, or site conditions, **Then** the changes are saved; **When** they try to invite, change roles, remove members, or delete the garden, **Then** those actions are refused.
4. **Given** a viewer, **When** they open the garden, **Then** they can read name, notes, site profile, and the member list (each member’s display name when present, email, and role); they cannot change garden fields or membership.
5. **Given** an owner, **When** they change a member from collaborator to viewer (or the reverse), or remove a member, **Then** the member’s access matches the new role immediately (removed members no longer see the garden).
6. **Given** a collaborator or viewer, **When** they leave the garden, **Then** it disappears from their list and remaining members keep access.
7. **Given** User A’s favorites and User B sharing a garden, **When** either user opens favorites or the plant catalog, **Then** favorites remain private to each account and the catalog remains shared reference data for all signed-in users (unchanged by garden membership).

---

### Edge Cases

- Create with blank or whitespace-only name: rejected with a clear message; no garden is created.
- Create or rename to a name the user already owns (comparison is case-insensitive after trim): rejected; the existing owned garden is unchanged.
- Duplicate invite of someone already a member: no second membership; owner sees that the person is already a member (optionally can change role instead).
- Owner invites their own email: rejected; the creator is already owner.
- Last remaining owner tries to leave or demote themselves: rejected until they transfer ownership to another member or delete the garden.
- Owner deletes a garden: the product asks for explicit confirmation; after confirm, the garden is permanently removed and members no longer see it; there is no undelete. Catalog and favorites are unaffected. After delete, the owner MAY create a new garden with the same name. Canceling confirm leaves the garden unchanged.
- User belongs to several gardens: list shows all of them with name and the user’s role on each; user can open any of them.
- Previously loaded garden list/detail while online, then the device goes offline: those cached gardens remain readable; creating gardens, editing, inviting, role changes, leaving, and deleting require connectivity and show a clear “you need to be online” state rather than silently failing or queuing.
- A membership change happens on another device while this device is offline: when back online, list/detail refresh to current membership; stale cached gardens the user was removed from are not treated as still accessible for new actions.
- Two members save name, notes, or site profile while both are online: the last successful save is kept; there is no merge editor. After save or a later load, each member sees the stored values.
- Viewer or stranger uses a direct link to a garden they do not belong to: no garden data is exposed; they see the same not-found outcome as a missing garden (not a distinct no-access signal that would confirm the garden exists).
- Frost dates set but zone missing, or zone set but frost dates missing: allowed; detail shows each field’s actual state. A single frost date may be set without the other.
- Both frost dates set with the same month-day, or last frost on or after first frost in the calendar year: rejected; previously saved valid values remain.
- Very long notes: accepted up to 4000 characters; longer notes are rejected with a validation message; the product does not crash.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to create a garden with a required non-empty name and optional notes, becoming the garden’s owner. The name MUST be unique among gardens that user currently owns (trim; case-insensitive). The same name MAY appear on gardens the user does not own (joined as collaborator or viewer).
- **FR-002**: Authenticated users MUST be able to list only the gardens they belong to and open each garden’s detail (name, notes, site profile, membership, and the current user’s role). Every member (owner, collaborator, and viewer) MUST see the same member list: each member’s email, display name when present, and role. Non-members MUST NOT see that list.
- **FR-003**: Owners and collaborators MUST be able to update a garden’s name and notes; viewers MUST NOT. Notes, when present, MUST be at most 4000 characters. An owner renaming a garden MUST still satisfy uniqueness among gardens they own. A collaborator renaming MUST NOT create a name collision with another garden owned by that garden’s owner. Concurrent online saves of the same garden MUST keep the last successful save; the product MUST NOT present a merge editor. After a save or a subsequent load, the user MUST see the currently stored values.
- **FR-004**: Owners MUST be able to delete a garden they own; collaborators and viewers MUST NOT. Delete MUST require an explicit confirmation step. After confirmation, deletion is permanent (no undelete or archive in this feature). Deleting a garden MUST NOT delete or alter plant catalog entries or any user’s favorites. The deleted garden’s name MAY be reused by that owner on a new garden.
- **FR-005**: A garden MUST store a site profile consisting of hardiness zone and last-frost and first-frost dates. Zone, when set, MUST be a single hardiness zone in the same 1–13 model used by the plant catalog. Frost dates, when set, MUST be annual month-and-day values (they repeat every year; they are not a single calendar year). When both frost dates are set, last frost MUST be earlier in the calendar year than first frost (northern-hemisphere spring-then-fall). Same-day and reversed pairs MUST be rejected. Either frost date MAY be unset independently of the other.
- **FR-006**: Owners and collaborators MUST be able to set, change, and clear site-profile fields; viewers MUST only read them. Unset frost dates or zone MUST display as not set, never as invented values.
- **FR-007**: Each garden MUST have exactly one owner at all times. Additional members MUST have role collaborator or viewer.
- **FR-008**: Owners MUST be able to add a member by the email address of an existing signed-in user account, choosing collaborator or viewer. Inviting an email with no account MUST fail clearly. This feature MUST NOT introduce a third-party sign-in or email-invitation identity provider.
- **FR-009**: Owners MUST be able to change a member’s role between collaborator and viewer, remove a member, and transfer ownership to an existing member (the previous owner becomes a collaborator unless they leave).
- **FR-010**: Collaborators and viewers MUST be able to leave a garden. The last owner MUST NOT leave or demote themselves until ownership is transferred or the garden is deleted.
- **FR-011**: Collaborators MUST be able to update name, notes, and site profile, and MUST NOT invite, change roles, remove others, transfer ownership, or delete the garden. Viewers MUST have read-only access to garden detail and to the full member list (name, email, role).
- **FR-012**: Users MUST NOT see, open, or modify gardens they do not belong to. A non-member MUST receive the same not-found outcome as a missing garden (no existence leak; not a distinct forbidden reveal). Unauthenticated users MUST NOT access any garden data.
- **FR-013**: Plant catalog search, filter, and detail MUST remain available to all authenticated users regardless of garden membership. Favorites MUST remain private to the owning user and MUST NOT become garden-shared in this feature.
- **FR-014**: After a garden list page and garden detail have been loaded while online, those previously loaded views MUST remain readable while offline. Creating, editing, deleting, inviting, changing roles, leaving, and transferring ownership MUST require connectivity in this feature and MUST surface a clear online-required state (no silent drop and no offline membership queue).
- **FR-015**: The feature MUST NOT include bed geometry, in-ground planting records, planting-date schedules, planting-calendar calculations, care reminders, or a layout canvas.

### Key Entities *(include if feature involves data)*

- **Garden**: A named household planning place. Has a name, optional notes, and a site profile (hardiness zone, last frost date, first frost date). Identity is stable while the garden exists so it can be reopened, shared, and used by later planning features. Display names are unique per owner among existing gardens, not globally. After confirmed delete, the garden is gone (no archived copy in this feature).
- **Site profile**: The growing-conditions facts attached to a garden (not to a user). Zone is the garden’s hardiness zone; last frost is the typical spring date after which hard frosts are unlikely; first frost is the typical fall date when hard frosts typically resume.
- **Membership**: A link between one authenticated user and one garden with a single role: owner, collaborator, or viewer. A user may belong to many gardens; a garden may have many members but only one owner.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**:
  - **Owner**: create was implicit; read; update name/notes/site profile; manage membership (invite, change roles, remove, transfer ownership); delete garden (permanent, after confirm); leave only after transfer.
  - **Collaborator**: read; update name/notes/site profile; leave. No membership management or delete.
  - **Viewer**: read garden detail and membership; leave. No updates.
- **Sharing rules**: A garden is shared only with specific existing users the owner invites by email. There is no public garden, no anonymous join link, and no household-wide default share of all gardens. Favorites are not shareable. Catalog plants remain readable by every authenticated user.
- **Isolation**: Garden list and detail MUST include only gardens the current user belongs to. One household MUST NOT see another’s gardens, notes, zone, frost dates, or member list (including emails). Within a garden, all members see the same member list. Favorites stay per-user. Catalog data stays common reference data.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Previously loaded garden list and garden detail MUST remain readable when the device cannot reach the server.
- Membership and garden mutations (create, edit, delete, invite, role change, leave, transfer) MUST NOT be queued offline in this feature; the user MUST see that they need connectivity.
- Losing connectivity MUST NOT block reading cached gardens or using already-cached plant catalog and favorites flows from the plant database feature.
- After reconnect, garden list/detail SHOULD reflect current membership (a user removed while offline MUST NOT keep acting as a member once the product has refreshed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of signed-in participants can create a named garden and reopen it from their list in under 2 minutes on the first attempt.
- **SC-002**: At least 90% of participants can set hardiness zone and both frost dates on a garden and confirm the same values on reopen, in under 2 minutes.
- **SC-003**: In a three-account check, after Owner invites Collaborator by email and does not invite Stranger: Collaborator sees the garden; Stranger’s list has 0 of Owner’s gardens; Stranger cannot open the garden (0 cross-household leaks).
- **SC-004**: Given fixture roles, collaborator edits to name/notes/site succeed and collaborator invite/delete attempts fail; viewer updates fail; 100% correct allow/deny on the fixture matrix.
- **SC-005**: Inviting an email with no account never creates a membership and shows a clear failure; inviting an existing member does not duplicate membership (verified on fixtures).
- **SC-006**: After loading list and detail online, going offline still shows those gardens; attempting an invite or edit offline shows an online-required state within 5 seconds and does not change membership.
- **SC-007**: At least 85% of participants agree they can tell who owns the garden and whether they can edit it or only view it.
- **SC-008**: Catalog and favorites behavior is unchanged by sharing: in a two-user shared garden, User B still cannot see User A’s favorites (0 leaks), and both can still browse the catalog.
- **SC-009**: On fixtures, saving last frost on or after first frost (including the same day) is rejected and prior values remain; a last-frost-before-first-frost pair saves (100% on the fixture set).
- **SC-010**: On fixtures, a user cannot own two gardens with the same name (case-insensitive, trimmed); they can still belong to another owner’s garden with that name (100%).
- **SC-011**: On fixtures, canceling delete leaves the garden; confirming delete removes it for every member with no restore path; the owner can then create a new garden using that name (100%).
- **SC-012**: On a two-editor fixture, the later successful save of name/notes/site profile is the stored result after both saves; a following load shows that result (100%).
- **SC-013**: On fixtures, owner, collaborator, and viewer each see every member’s email and role; a non-member sees none of those emails (100%).

## Assumptions

- Existing email-and-password accounts from the plant database feature are reused; this feature does not add registration, password reset, or third-party sign-in.
- A user may own or join multiple gardens (e.g. front yard and community plot). Names of gardens a user owns are unique for that owner (trim, case-insensitive). Names need not be unique across the product or among gardens the user only joins.
- Hardiness zones are integers 1–13, matching the plant catalog’s zone model.
- Frost dates are typical annual dates (month and day), not timestamps for a specific year and not per-bed microclimates. Last frost is the spring date; first frost is the fall date. When both are set, last frost must precede first frost in the calendar year (e.g. April 15 last frost and October 20 first frost is valid; October before April, or both May 1, is not). Southern-hemisphere season reversal is out of scope for v1.
- Zone is recommended but not mandatory at create time so a gardener can name a garden before they look up frost dates; later calendar work will treat missing frost dates as “calendar not available for this garden.”
- Invite is immediate membership for an existing account (no pending-invite inbox, expiry, or email-send requirement in v1). If the product later sends notification email, that is out of scope here.
- Display of members uses account email and display name when present. Owner, collaborator, and viewer all see that same list; it is not hidden from viewers and is not visible to non-members.
- Notes are plain text for household context (soil, sun, landlord rules); they are not structured bed lists. Maximum length is 4000 characters.
- Bed geometry, planting dates, planting-calendar math, in-ground inventory, care reminders, layout canvas, purchasing, and companion-planting rules are out of scope.
- Garden list presentation is suitable for household scale (tens of gardens per user, not thousands); exact paging follows product UX defaults at planning time.
