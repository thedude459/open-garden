# Feature Specification: Seasonal Plantings

**Feature Branch**: `004-seasonal-plantings`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Record what is actually planted this season (variety, garden, optional named bed, plant/harvest dates) as a list, not a map. Named beds are containers (e.g. Raised bed 1), not polygons. Offline add/remove/update with queue-and-sync. Depends on household gardens and the plant catalog."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Planting in a Garden (Priority: P1)

A garden owner or collaborator records that a catalog variety is planted (or will be planted) in a garden this season, with a planted date when known, and later marks an actual or expected harvest date. They can reopen the garden’s planting list, recognize each entry, and remove plantings that were a mistake or were pulled out.

**Why this priority**: “What is in the ground” is the join between catalog varieties and a household garden. Layout and care reminders have nothing to attach to without it.

**Independent Test**: As owner, add a planting for a catalog plant in a garden, see it on that garden’s list with enough identity to reopen the variety, set or clear dates, remove it; a non-member sees none of those plantings.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator and a catalog plant, **When** they add a planting to a garden they belong to, **Then** the planting appears on that garden’s planting list with the variety’s identity (common name, species, cultivar when known).
2. **Given** a planting without a planted date yet, **When** a member opens the list, **Then** the entry is still listed and planted date is clearly not set (planned vs in-ground can be distinguished without inventing a date).
3. **Given** an owner or collaborator, **When** they set or change planted date and/or harvest date, **Then** those dates persist and other members see them.
4. **Given** an owner or collaborator, **When** they remove a planting, **Then** it disappears from the garden list; the catalog plant and any personal favorite remain.
5. **Given** a viewer, **When** they open the planting list, **Then** they can read it; they cannot add, edit, or remove plantings.
6. **Given** User B is not a member, **When** they are signed in, **Then** they do not see User A’s garden plantings.

---

### User Story 2 - Optional Named Beds as Lists (Priority: P2)

A gardener optionally assigns a planting to a named bed in that garden (for example “Raised bed 1” or “Patio pots”) so the planting list can be grouped or filtered by bed. Beds are labels/containers, not drawn shapes.

**Why this priority**: Households talk about beds before they need a map. Grouping by name keeps the list usable; geometry is a later layout feature.

**Independent Test**: Owner creates a named bed, assigns two plantings to it, filters or groups the list by that bed, moves a planting to another bed or to no bed; viewer cannot create beds.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator, **When** they create a named bed in a garden, **Then** that name appears as a container they can assign plantings to.
2. **Given** plantings in more than one bed, **When** the user views the planting list grouped or filtered by bed, **Then** each planting shows under the correct bed; plantings with no bed are in a clear unassigned group.
3. **Given** an owner or collaborator, **When** they rename a bed, **Then** plantings assigned to it still belong to it and show the new name.
4. **Given** an owner or collaborator, **When** they delete a named bed, **Then** the bed is gone and its plantings remain in the garden as unassigned (not silently deleted).
5. **Given** a viewer, **When** they view plantings, **Then** they can see bed names but cannot create, rename, or delete beds.

---

### User Story 3 - Offline Planting Changes Queue and Sync (Priority: P3)

When offline, an owner or collaborator can add, update, or remove plantings on-device immediately. Changes sync when connectivity returns. Pending status is visible. The product does not silently drop intent.

**Why this priority**: Planting records are often captured in the yard with poor connectivity. Unlike garden membership, these mutations should queue. Sharing and bed geometry still stay out of this story’s scope.

**Independent Test**: Go offline, add a planting, see it on the list as pending, reconnect, confirm it appears for another member after sync; conflict with last-intent wins as specified.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator is offline, **When** they add, edit dates, reassign bed, or remove a planting, **Then** the change is visible on-device immediately and marked pending until synced.
2. **Given** pending planting changes, **When** connectivity returns, **Then** the garden’s planting list matches the user’s last on-device intent after one successful sync cycle.
3. **Given** sync has not completed, **When** the user views the list, **Then** they can tell which items are still pending or need attention.
4. **Given** a viewer is offline, **When** they view a previously loaded planting list, **Then** they can read it but cannot queue mutations.

---

### Edge Cases

- Duplicate planting of the same variety in the same garden: allowed (two rows of tomatoes in different beds or successive sowings); identity is the planting record, not the variety alone.
- Harvest date before planted date: rejected with a clear message.
- Catalog plant later deprecated or removed: planting list still shows the record with an unavailable-variety indicator; user can still remove it.
- User removed from the garden while they have pending offline planting edits: on reconnect, mutations MUST NOT apply; user sees that they no longer have access; intent is not applied to a garden they cannot belong to.
- Empty garden planting list: clear empty state.
- Named bed with blank name: rejected.
- Two beds with the same name in one garden: rejected or disambiguated clearly; names are unique per garden.
- Offline queue vs a member who deleted the planting online: last successful server state plus documented last-intent rule; user sees if their pending change could not apply.
- Unauthenticated access: no planting data.
- This feature does not draw bed shapes, compute spacing, or create care reminders.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Owners and collaborators MUST be able to add a planting that links one catalog variety to one garden they belong to.
- **FR-002**: Garden members MUST be able to list plantings for a garden they belong to, with variety identity and planted/harvest dates (each date optional until set).
- **FR-003**: Owners and collaborators MUST be able to update planted date, harvest date, and bed assignment, and MUST be able to remove a planting.
- **FR-004**: Viewers MUST read plantings and MUST NOT create, update, or delete them.
- **FR-005**: Owners and collaborators MUST be able to create, rename, and delete named beds within a garden. Beds MUST be named containers only (no size, shape, or map position in this feature).
- **FR-006**: A planting MAY be assigned to one bed in its garden or to no bed. Deleting a bed MUST NOT delete its plantings; they become unassigned.
- **FR-007**: Planting lists MUST be isolatable by garden membership: non-members MUST see none of that garden’s plantings or bed names.
- **FR-008**: When offline, owners and collaborators MUST be able to add, update, and remove plantings on-device immediately; those changes MUST sync when connectivity returns and MUST NOT be silently dropped. Pending or failed sync MUST be visible.
- **FR-009**: Previously loaded planting lists MUST remain readable offline for members (including viewers).
- **FR-010**: Catalog entries and personal favorites MUST NOT be deleted when a planting is removed. Plantings MUST NOT appear on a personal favorites list unless the user also favorited the variety.
- **FR-011**: The feature MUST NOT include bed geometry, layout canvas, planting-calendar math, or care reminders.

### Key Entities *(include if feature involves data)*

- **Planting**: A household record that a catalog variety is planned or present in a specific garden this season. Optional planted date, optional harvest date, optional named bed. Distinct from a calendar plan line and from a personal favorite.
- **Named bed**: A label/container inside one garden (name unique within that garden). No geometry in this feature.
- **Garden** and **Plant** (catalog variety): Already defined in prior features; plantings reference them.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: **Owner** and **collaborator** create/update/delete plantings and named beds. **Viewer** reads only. Non-members: no access.
- **Sharing rules**: Plantings and bed names are garden-shared among members. They are not globally visible. Favorites stay personal.
- **Isolation**: Garden A’s plantings and beds MUST never appear in Garden B or to non-members.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Read of previously loaded planting lists works offline.
- Owner/collaborator planting and bed mutations queue on-device and sync on reconnect; last intentional action per planting wins when coalescing rapid repeats.
- If sync fails, pending state stays visible.
- Membership changes remain online-only (Household Gardens); a queued planting MUST NOT grant access to a garden the user was removed from.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants can add a planting of a named variety to a garden and see it on the list in under 1 minute.
- **SC-002**: On fixtures, harvest-before-planted is rejected; removing a planting leaves the catalog plant intact (100%).
- **SC-003**: Named-bed assign/group/unassign and delete-bed-keeps-plantings behave correctly on fixtures (100%).
- **SC-004**: Non-members see 0 plantings; viewers cannot mutate (100% on the role fixture).
- **SC-005**: Offline add then reconnect: the planting exists for another member within one successful sync cycle; pending is visible before sync (SC aligned with favorites offline intent).
- **SC-006**: At least 85% of participants can tell which plantings are unassigned vs in a named bed.

## Assumptions

- Household Gardens membership and the plant catalog already exist.
- “This season” is a household notion; v1 does not require a formal season object or automatic year rollover (dates on the planting are enough).
- Multiple plantings of the same variety in one garden are allowed.
- Planting calendar entries (plans) are not automatically turned into plantings; the gardener records plantings explicitly.
- Layout designer will consume these plantings later; this feature only needs a list.
- Care reminders will consume these plantings later; this feature does not generate reminders.
- Date values are calendar dates in the garden’s household context (no separate time zone per planting in v1).
