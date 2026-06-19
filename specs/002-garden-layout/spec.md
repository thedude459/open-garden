# Feature Specification: Garden Layout & Planting

**Feature Branch**: `004-garden-layout`

**Spec directory**: `specs/002-garden-layout` (independent of git branch name)

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "I want to allow the user to create gardens now. The gardens should be create with a length and a width. The user should be allow to create beds inside of the garden for planting and also non-plantable areas like walking paths. The plants in the beds need to be correctly spaced and not allow incompatible plants to be planted next to each other. The garden and beds should be changeable via the UI and the UI should also allow the user to start a plant indoors that will be later planted into a bed or direct seed into the bed."

## Clarifications

### Session 2026-06-19

- Q: When a user chooses "start indoors" and selects a target bed, should that plant occupy bed space immediately or only after transplant? → A: Do not occupy bed space until transplanted; track indoor starts separately with a linked target bed.
- Q: Should spacing and incompatibility validation apply across bed boundaries within the same garden? → A: Yes — validate spacing and incompatibility across all placements within a garden, regardless of bed boundaries.
- Q: Does each plant placement represent one individual plant or a quantity/group at one spot? → A: One placement equals one plant instance at a position.
- Q: If a user edits the same garden on two devices and both save, how should conflicts be handled? → A: Detect stale edits (version/timestamp check) and prompt user to review or overwrite before saving.
- Q: For bed soil type and sun exposure, predefined lists or free text? → A: Predefined lists for both (soil: USDA texture triangle classes; sun: full sun/partial shade/full shade).
- Q: What does "bed rotation" mean for this feature? → A: Both geometric rotation of bed/path rectangles in the layout editor and crop rotation planning (plant family history per bed with repeat-planting guidance).
- Q: What rotation increments should beds/paths support in the layout editor? → A: 90° increments only (0°, 90°, 180°, 270°).
- Q: When crop rotation conflict detected, advisory warning or hard block? → A: Advisory warning only — allow save if spacing and incompatibility pass.
- Q: How long should crop rotation lookback be? → A: Per plant family from catalog when available; 3-year default otherwise.
- Q: Which predefined soil types should beds support in v1? → A: USDA soil texture triangle — 12 classes: sand, loamy sand, sandy loam, loam, silt loam, silt, sandy clay loam, clay loam, silty clay loam, sandy clay, silty clay, clay.
- Q: What role should bed soil type play in v1 beyond storage and display? → A: Metadata only — stored and displayed; no placement validation or warnings in v1.
- Q: How should the 12 USDA soil types be presented in the bed editor? → A: Grouped by dominant texture — sand-dominant, loam, silt-dominant, and clay-dominant subgroups.
- Q: Can users clear bed soil type after setting it (return to unset)? → A: Yes — clearable to unset/null ("Not set") at any time.
- Q: Where should bed soil type be visible in the layout UI? → A: Layout canvas only — abbreviated label on each bed when set.
- Q: When should geometric bed/path rotation (90° increments, OBB validation) be deliverable? → A: US6 only — geometric rotation delivered with crop rotation; US2–US5 create axis-aligned beds/paths (rotation_degrees defaults to 0).
- Q: When should bed planting history records be created? → A: US3 — create history on every direct seed and transplant; US6 adds rotation warnings using accumulated history.
- Q: Should advisory companion planting hints appear at placement time in v1? → A: No — defer companion hints to a future feature; v1 enforces incompatibility hard blocks and spacing only.
- Q: Where should bed sun exposure be visible in the layout UI? → A: Layout canvas only — abbreviated label when set; not in a separate detail panel.
- Q: Should validate-placement dry-run return advisory warnings in addition to hard-block violations? → A: Yes — validate-placement returns violations (hard blocks) and warnings (climate from US5, crop rotation from US6).

A signed-in home gardener creates a new garden area by giving it a name and
setting its overall length and width. The garden represents their physical
growing space and becomes the container for beds, paths, and future plant
placements.

**Why this priority**: A defined garden boundary is the foundation for all
layout, bed, and planting features. Without it, nothing else in this feature can
exist.

**Independent Test**: Can be fully tested by creating a garden with valid
dimensions and verifying it appears in the user's garden list with the correct
size — no beds or plants required.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a garden with a name, length,
   and width, **Then** the garden is saved to their account and appears in their
   garden list.
2. **Given** a signed-in user enters garden dimensions, **When** length or width
   is zero or negative, **Then** the system prevents save and shows a clear
   validation message.
3. **Given** a signed-in user creates a garden, **When** they choose a measurement
   unit (feet or meters), **Then** the garden stores and displays dimensions in
   that unit consistently.
4. **Given** a user is not signed in, **When** they attempt to create a garden,
   **Then** the system prompts them to sign in before saving.

---

### User Story 2 - Define Plantable Beds and Non-Plantable Paths (Priority: P2)

Within an existing garden, the user adds axis-aligned rectangular beds for
planting and non-plantable areas (such as walking paths) by setting each area's
position, length, and width inside the garden boundary. Beds and paths must fit
within the garden and must not overlap each other. Geometric rotation is
delivered in User Story 6.

**Why this priority**: Beds and paths translate a blank garden into a usable
layout. Planting and validation depend on knowing which areas accept plants.

**Independent Test**: Can be tested by opening a garden, adding at least one bed
and one path, and verifying both render correctly within the garden boundary
without overlap — no plants required.

**Acceptance Scenarios**:

1. **Given** a garden exists, **When** the user adds a bed with position, length,
   and width that fit inside the garden, **Then** the bed is saved and displayed
   as a plantable area.
2. **Given** a garden exists, **When** the user adds a non-plantable path area,
   **Then** the path is saved and displayed distinctly from plantable beds.
3. **Given** a user attempts to place a bed or path, **When** any part extends
   outside the garden boundary, **Then** the system prevents save and explains
   the boundary violation.
4. **Given** beds or paths already exist, **When** the user adds a new area that
   would overlap an existing bed or path, **Then** the system prevents save and
   explains the overlap conflict.
5. **Given** a bed exists, **When** the user views or edits it, **Then** they
   can optionally set soil type and sun exposure by selecting from predefined
   lists (soil: USDA texture triangle grouped by dominant texture — sand-dominant:
   sand, loamy sand, sandy loam, sandy clay loam, sandy clay; loam: loam;
   silt-dominant: silt loam, silt, silty clay loam, silty clay; clay-dominant:
   clay loam, clay; sun: full sun, partial shade, full shade).
6. **Given** a bed has soil type set, **When** the user views the garden layout,
   **Then** an abbreviated soil label is shown on that bed in the layout canvas;
   beds with unset soil type show no soil label on the canvas.
7. **Given** a bed has sun exposure set, **When** the user views the garden layout,
   **Then** an abbreviated sun exposure label is shown on that bed in the layout
   canvas; beds with unset sun exposure show no sun label on the canvas.

---

### User Story 3 - Place Plants with Spacing and Compatibility Validation (Priority: P3)

The user selects a plant from the catalog and places it in a bed. The system
enforces correct spacing based on the plant's requirements and blocks placement
of incompatible plants adjacent to one another, evaluating all placements
within the garden — not just within the same bed. Spacing violations and
incompatible adjacency are hard blocks; climate and timing warnings outside
recommended windows are advisory only.

**Why this priority**: Validated placement is a core product promise (constitution
Principle II). It prevents biologically harmful layouts and delivers immediate
value from the plant database.

**Independent Test**: Can be tested by placing plants in a bed and verifying
spacing rules and incompatibility blocks — independent of indoor-start or
direct-seed workflows.

**Acceptance Scenarios**:

1. **Given** a bed exists and a plant is selected from the catalog, **When** the
   user places the plant at a valid position with sufficient spacing, **Then**
   the placement is saved and shown on the bed layout.
2. **Given** a plant requires minimum spacing, **When** the user attempts to place
   it closer than the required distance to another plant (same or different
   species), **Then** the system blocks placement and shows the spacing violation.
3. **Given** two plants are marked as incompatible companions, **When** the user
   attempts to place them within each other's spacing zones — including across
   adjacent bed boundaries in the same garden — **Then** the system blocks
   placement and identifies the incompatible pairing.
4. **Given** a plant is placed, **When** the user views the bed, **Then** each
   placement represents a single plant instance, shows the plant name, and
   occupies space proportional to its spacing requirement.
5. **Given** a user previews placement via validate-placement, **When** spacing
   and incompatibility pass but advisory conditions apply, **Then** the response
   includes `warnings[]` (empty `violations[]`); hard blocks appear in
   `violations[]` only.
6. **Given** a user attempts to place a plant in a path or non-plantable area,
   **When** they confirm placement, **Then** the system prevents save and directs
   them to a plantable bed.
7. **Given** a user direct-seeds a plant in a bed, **When** the placement is
   saved, **Then** a bed planting history record is created with bed, plant,
   rotation group (or botanical family fallback when available), and planted date.

---

### User Story 4 - Edit Garden and Bed Layout via UI (Priority: P4)

The user returns to an existing garden to change its dimensions, rename it,
resize or reposition beds and paths, or remove areas. When layout changes would
invalidate existing plant placements (e.g., shrinking a bed below occupied
space), the system warns the user and requires confirmation or adjustment before
applying the change.

**Why this priority**: Gardens evolve season to season. Editable layouts keep the
planning tool useful over time without forcing users to recreate from scratch.

**Independent Test**: Can be tested by modifying garden dimensions and bed
geometry on an existing layout and verifying changes persist correctly.

**Acceptance Scenarios**:

1. **Given** a garden exists, **When** the user changes its name, length, or
   width within valid bounds, **Then** the updated garden is saved and displayed.
2. **Given** a bed or path exists, **When** the user resizes or repositions it
   without causing overlap or boundary violations, **Then** the change is saved.
3. **Given** a bed contains plant placements, **When** the user shrinks the bed
   such that placements no longer fit, **Then** the system warns which placements
   are affected and requires the user to resolve conflicts before saving.
4. **Given** a bed or path exists, **When** the user deletes it, **Then** the
   system confirms deletion and removes associated plant placements in that area
   after user confirmation.
5. **Given** layout edits are in progress, **When** the user cancels without
   saving, **Then** no partial changes are persisted.
6. **Given** a user has a garden open for editing, **When** another session saves
   changes to the same garden and the first user attempts to save, **Then** the
   system detects the stale version and prompts the user to review the remote
   changes, discard their edits, or overwrite with confirmation — partial
   silent data loss does not occur.

---

### User Story 5 - Start Indoors or Direct Seed into a Bed (Priority: P5)

When adding a plant to a bed, the user chooses whether to start the plant
indoors (for later transplant) or direct seed into the bed. The system records
the planting method, the planting or start date, and lifecycle status (not
phenological growth stage) so future scheduling features can build on this state.

**Why this priority**: Planting method affects timing, care tasks, and
transplant windows. Capturing it at placement time connects layout to the
broader garden management workflow.

**Independent Test**: Can be tested by placing a plant with each method and
verifying the recorded method, date, and status display correctly on the bed
layout — independent of task scheduling.

**Acceptance Scenarios**:

1. **Given** a user adds a plant via "start indoors" and selects a target bed,
   **When** they save, **Then** an indoor start record is created with a start
   date and linked target bed, the plant does **not** occupy space on the bed
   layout, and the indoor start appears in a separate indoor-starts list.
2. **Given** a user places a plant in a bed, **When** they choose "direct seed,"
   **Then** the placement is recorded as direct-seeded in that bed with a sow
   date.
3. **Given** a plant supports only one planting method per catalog rules, **When**
   the user selects a method, **Then** the unavailable method is disabled or
   hidden with a brief explanation.
4. **Given** an indoor start record exists with a linked target bed, **When**
   the user marks it as transplanted and confirms a position in that bed,
   **Then** a bed placement is created (occupying bed space), spacing and
   incompatibility rules are validated at transplant time, a bed planting history
   record is created, and the indoor start record is marked complete.
5. **Given** a user selects a planting date outside the plant's recommended window
   for their saved location, **When** they confirm placement, **Then** the system
   shows a warning contextualized to their climate but allows save if spacing and
   compatibility rules pass.

---

### User Story 6 - Bed Rotation: Geometry and Crop History (Priority: P6)

The user rotates bed and path rectangles in the layout editor for a better
physical fit, and tracks crop rotation by assigning plant families to beds over
time. When placing a plant, the system checks recent planting history for that
bed and provides rotation guidance if the same plant family was planted there
recently.

**Why this priority**: Rotation support improves real-world layout accuracy and
long-term soil health — both are core gardener needs once basic layout and
planting exist.

**Independent Test**: Rotate a bed 90° and verify overlap detection uses rotated
bounds; plant tomatoes in a bed, clear placements next season, attempt same
family again — rotation guidance appears.

**Acceptance Scenarios**:

1. **Given** a bed exists, **When** the user sets a rotation angle in the layout
   editor, **Then** the bed rotates in 90° increments (0°, 90°, 180°, 270°),
   renders rotated, and saves with `rotation_degrees`.
2. **Given** rotated beds exist, **When** the user attempts overlapping area
   placement, **Then** overlap detection uses oriented (rotated) bounding boxes.
3. **Given** a bed has recent planting history for a plant family, **When** the
   user places a plant of the same family in that bed, **Then** the system shows
   an advisory rotation warning identifying the conflict and recommended wait
   period (based on catalog family rotation window or 3-year default) but allows
   save if spacing and incompatibility rules pass.
4. **Given** a bed has no conflicting rotation history, **When** the user places
   any plant, **Then** no rotation warning is shown.

---

### Edge Cases

- What happens when a user creates a bed or path in US2–US5? Areas are saved
  axis-aligned with `rotation_degrees = 0`; rotation controls are unavailable
  until User Story 6.
- What happens when a user creates a garden but adds no beds? The garden is
  saved and displayed; planting actions prompt the user to add a bed first.
- What happens when catalog spacing data is missing for a plant? Placement is
  blocked with a message that spacing data is unavailable; the user is directed
  to choose a different plant or complete provisional plant data if applicable.
- What happens when incompatible relationship data is missing? Placement is
  allowed; spacing rules still apply. Missing incompatibility data does not block
  placement.
- What happens when a user resizes the garden smaller so existing beds extend
  outside the new boundary? Save is blocked until beds are moved or resized to
  fit, with a clear list of conflicting areas.
- What happens when two beds share an edge but do not overlap? Adjacent beds are
  allowed; only true area overlap is rejected. Spacing and incompatibility
  validation still applies across the shared edge as part of garden-wide checks.
- What happens when a user tries to place more plants than a bed can physically
  hold at required spacing? Each placement represents one plant; each individual
  placement is validated garden-wide; the user cannot exceed biological spacing
  limits even if empty visual space appears available at reduced zoom.
- What happens when a user deletes a garden? The system confirms deletion and
  removes all beds, paths, and plant placements within that garden after
  confirmation.
- What happens when the user is offline? Layout viewing and editing work for
  gardens and beds already cached for the user; changes sync when connectivity
  returns. Plant placement requires catalog spacing data — available for cached
  plants, blocked with an offline message for uncached plants. If a sync conflict
  is detected when reconnecting, the user is prompted to review or resolve
  before changes are applied.
- What happens when two sessions edit the same garden concurrently? On save, the
  system compares version/timestamp; if stale, the user must review remote
  changes, discard local edits, or confirm overwrite — silent last-write-wins
  is not permitted.
- What happens when an indoor-started plant's target bed is deleted? The indoor
  start record remains active with `target_bed_area_id` cleared; the system
  prompts the user to reassign a target bed (PATCH) or remove the record.
- What happens when a user tries to transplant an indoor start but the target
  bed has no space at required spacing? Transplant is blocked with a spacing or
  incompatibility message; the indoor start record stays active until a valid
  position is available or the user reassigns the target bed.
- What happens when a rotated bed extends outside the garden boundary after
  rotation? Save is blocked with a boundary violation message showing the rotated
  footprint.
- What happens when overlap detection fails between two rotated beds sharing a
  corner? Oriented bounding-box intersection is used; any overlap blocks save.
- What happens when catalog data lacks a plant family for rotation checks?
  Rotation identity resolves as: curated rotation group → botanical family →
  if both missing, rotation warning is skipped; spacing and incompatibility
  rules still apply.
- What happens when a user clears all placements from a bed? Planting history
  records are retained for rotation guidance across seasons.
- What happens when a bed has no soil type set? Placement, spacing, and
  incompatibility validation proceed normally; soil type is display-only metadata
  in v1 and does not affect validation or warnings.
- What happens when a user changes or clears bed soil type after plants are
  placed? The update is allowed; existing placements are unaffected because soil
  type does not drive validation in v1. Clearing soil type sets the value to
  null and removes the canvas label.
- What happens when a bed has no sun exposure set, or the user clears it?
  Same as soil — metadata only; clearing sets null and removes the canvas label.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to create one or more
  gardens, each with a name, length, width, and measurement unit (feet or meters).
- **FR-002**: System MUST persist gardens per user account so they are available
  across sessions and devices after sign-in.
- **FR-003**: System MUST allow users to add plantable beds within a garden, each
  defined by position (offset from garden origin), length, and width.
- **FR-004**: System MUST allow users to add non-plantable areas (e.g., walking
  paths) within a garden using the same geometric model as beds but marked as
  non-plantable.
- **FR-005**: System MUST validate that all beds and paths remain fully within
  garden boundaries and do not overlap each other. Validation uses axis-aligned
  bounding boxes in US2–US5 (`rotation_degrees = 0`); oriented bounding boxes
  apply from US6 when rotation is enabled (FR-021).
- **FR-006**: System MUST allow optional per-bed attributes selected from
  predefined lists: soil type (USDA texture triangle — sand, loamy sand, sandy
  loam, loam, silt loam, silt, sandy clay loam, clay loam, silty clay loam,
  sandy clay, silty clay, clay) and sun exposure (full sun, partial shade, full
  shade). Soil type and sun exposure are metadata only in v1 — neither MUST
  trigger placement validation or advisory warnings. The bed editor MUST present
  soil types grouped by dominant texture: sand-dominant (sand, loamy sand, sandy
  loam, sandy clay loam, sandy clay), loam (loam), silt-dominant (silt loam,
  silt, silty clay loam, silty clay), clay-dominant (clay loam, clay). Users MUST
  be able to clear soil type or sun exposure back to unset (null) at any time.
  When set, each attribute MUST be displayed on the layout canvas as an
  abbreviated label on the bed; neither MUST be shown in a separate detail panel.
- **FR-007**: System MUST allow users to place catalog plants (authoritative or
  user provisional) only in plantable beds, not in paths or outside beds. Each
  placement represents exactly one plant instance at a position.
- **FR-008**: System MUST enforce minimum spacing for each plant placement using
  spacing requirements from the plant database, evaluated garden-wide across all
  bed placements in the same garden.
- **FR-009**: System MUST block placement when an incompatible plant would be
  within another plant's required spacing zone anywhere in the same garden;
  incompatible overrides are never permitted.
- **FR-010**: System MUST display spacing violations and incompatibility blocks
  with clear messages identifying the affected plants.
- **FR-011**: System MUST allow users to edit garden name and dimensions, and to
  resize, reposition, or delete beds and paths via the layout UI.
- **FR-012**: System MUST warn users and require conflict resolution before saving
  layout changes that would orphan or invalidate existing plant placements.
- **FR-013**: System MUST allow users to choose a planting method when adding a
  plant: indoor start (tracked separately with a linked target bed) or direct
  seed (occupying bed space immediately).
- **FR-014**: System MUST record planting method, relevant date (start date or
  sow date), and lifecycle status. Direct-seed and transplanted plants use
  `placement_status` (`direct_seeded`, `transplanted`); indoor starts use
  `indoor_start_status` (`active`, `transplanted`, `cancelled`). Phenological
  growth stage tracking is deferred to the task-scheduling feature.
- **FR-015**: System MUST allow users to mark an indoor start as transplanted
  into its linked target bed at a chosen position, validating spacing and
  incompatibility at transplant time before creating the bed placement.
- **FR-016**: System MUST respect catalog rules about which planting methods are
  valid for each plant (e.g., disable direct seed when only transplant is
  supported).
- **FR-017**: System MUST show climate-contextual warnings when planting dates
  fall outside recommended windows for the user's saved location, without
  blocking save when spacing and compatibility rules pass. Climate warnings MUST
  appear in validate-placement dry-run responses (from US5) and on save.
- **FR-017a**: System MUST expose a validate-placement dry-run endpoint that
  returns hard-block `violations[]` (spacing, incompatibility) and advisory
  `warnings[]` (climate from US5, crop rotation from US6) without persisting,
  enabling live UI preview per SC-002.
- **FR-018**: System MUST render the garden layout visually so users can see
  garden boundary, beds, paths, and plant placements in proportion to their
  dimensions. When bed soil type or sun exposure is set, the layout canvas MUST
  show abbreviated labels on that bed.
- **FR-019**: System MUST require authentication to create, edit, or delete
  gardens, beds, paths, and plant placements.
- **FR-020**: System MUST track a version or last-modified timestamp on each
  garden and detect stale edits on save; when a conflict is detected, the user
  MUST be prompted to review remote changes, discard local edits, or confirm
  overwrite before persisting — silent last-write-wins is not permitted.
- **FR-021**: System MUST allow users to rotate bed and path rectangles in the
  layout editor in **90° increments only** (0°, 90°, 180°, 270°), storing
  `rotation_degrees` on each garden area and validating overlap and boundary
  constraints using oriented (rotated) bounding boxes.
- **FR-022**: System MUST record bed planting history for each placement save
  starting in US3 (direct seed) and US5 (transplant), capturing bed, plant,
  rotation group or botanical family fallback, and planted date; retain history
  when placements are removed.
- **FR-023**: System MUST evaluate crop rotation rules when placing a plant in a
  bed (delivered in US6), using planting history accumulated from US3/US5, and
  show an **advisory** rotation warning (not a hard block) when the same rotation
  group (or botanical family when no rotation group exists) was planted in that
  bed within the rotation window; the window is per family/group from the catalog
  when available, otherwise a **3-year default**; save proceeds if spacing and
  incompatibility rules pass. Rotation warnings MUST appear in validate-placement
  dry-run responses and on save.
- **FR-024**: System MUST resolve rotation identity as: curated rotation group
  from catalog first, botanical family as fallback; if neither is available,
  skip rotation warning for that plant.

### Key Entities

- **Garden**: A user's defined growing area with name, length, width, measurement
  unit, version or last-modified timestamp, and optional description. Contains
  beds, paths, and serves as the spatial boundary for layout validation.
- **Bed**: A plantable rectangular area within a garden, defined by position,
  dimensions, and `rotation_degrees` (0, 90, 180, or 270 only). Optional soil
  type (USDA texture triangle class) and sun exposure (full sun, partial shade,
  full shade), each selected from predefined lists. Holds plant placements and
  planting history.
- **Path (Non-Plantable Area)**: A rectangular non-plantable zone within a
  garden (e.g., walkway), defined by position, dimensions, and `rotation_degrees`
  (0, 90, 180, or 270 only). Occupies garden space but rejects plant placement.
- **Plant Placement**: A single instance of a catalog plant positioned within a
  bed at coordinates, with spacing footprint, sow or transplant date, and status
  (e.g., direct seeded, transplanted). One placement equals one plant. Only
  direct-seeded and transplanted plants occupy bed space.
- **Indoor Start**: A catalog plant started indoors, stored separately from bed
  layout, with start date, linked target bed, and status (active or
  transplanted). Does not occupy bed space until transplant creates a plant
  placement.
- **Bed Planting History**: A record of a plant (and its rotation group or
  botanical family fallback) planted in a bed on a given date. Retained after
  placement removal to support crop rotation guidance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a garden with dimensions and at least one bed in
  under 5 minutes on first attempt.
- **SC-002**: 95% of plant placement attempts that violate spacing or
  incompatibility rules are blocked before save, with an explanatory message
  shown within 2 seconds of the attempt; validate-placement dry-run returns
  advisory warnings in the same response when applicable.
- **SC-003**: Users can modify an existing garden layout (resize a bed or change
  garden dimensions) and see saved results persist correctly across sessions in
  100% of successful save operations.
- **SC-004**: 90% of users successfully complete a full flow (create garden →
  add bed → place plant with chosen planting method) without assistance on first
  try.
- **SC-005**: Layout validation prevents 100% of overlapping bed/path
  configurations and out-of-boundary areas from being saved.
- **SC-006**: Users can distinguish plantable beds from non-plantable paths at a
  glance on the layout view without opening detail panels.
- **SC-007**: Rotated bed overlap and boundary violations are blocked before save
  in 100% of invalid configurations.
- **SC-008**: Rotation guidance appears within 2 seconds when a user places a
  plant family in a bed with conflicting recent history.

## Assumptions

- Users are authenticated via the existing email/password sign-in from the plant
  database feature; garden data is per-user and server-persisted.
- The plant database (Feature 001) is available and provides spacing requirements,
  companion/incompatible relationships, planting method rules, climate windows,
  rotation groups, botanical families, and per-family rotation windows for
  catalog plants.
- Garden areas in this feature focus on rectangular beds and paths (optionally
  rotated) within a rectangular garden boundary. Orchard tree spacing, mixed-use
  zone types, and non-rectangular polygon shapes are out of scope for this
  feature and will be addressed in a future specification.
- Constitution Domain Requirements for Orchard and Mixed-use zone types are
  explicitly deferred to a future specification. This feature delivers the
  "Garden" zone type only (rectangular beds/paths). See plan.md Complexity
  Tracking.
- Companion planting **suggestions** (beneficial companion hints at placement
  time) are deferred to a future UX iteration; v1 enforces incompatibility hard
  blocks and spacing only — no advisory companion hint UI in this feature.
- Measurement units are limited to feet and meters; unit conversion between
  gardens is not required.
- Visual layout editing uses a proportional top-down view; precise sub-inch
  positioning is not required beyond spacing validation accuracy.
- Climate warnings for out-of-window planting dates are advisory; hard blocks
  apply only to spacing and incompatibility per constitution Principle II.
- Crop rotation warnings are advisory only; hard blocks apply only to spacing
  and incompatibility, not repeat plant families in the same bed.
- Bed soil type uses the USDA soil texture triangle (12 predefined classes) and
  is optional metadata only in v1; it does not affect placement validation,
  spacing, incompatibility, climate, or rotation warnings. Soil-aware plant
  matching and watering logic are deferred to future features (constitution
  Principle III). Soil and sun exposure labels appear on the layout canvas only
  (abbreviated when set); editing uses the bed create/edit form (grouped soil
  selector; flat sun exposure selector).
