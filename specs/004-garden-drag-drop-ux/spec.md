# Feature Specification: Intuitive Garden Planting Experience

**Feature Branch**: `006-garden-drag-drop-ux`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "The garden page is not user friendly and the colors make some of the buttons difficult to see. I want the user to be able to drag and drop plantings into a garden bed. Having to give a X and Y coordinates to do a planting doesn't make any sense. This needs to be easy to use, user friendly, and look like a professional application."

## Clarifications

### Session 2026-07-07

- Q: Should canvas bed and path editing (draw, move, resize on canvas) ship in v1? → A: Defer layout editing — v1 covers drag-and-drop planting, transplant, and visual polish only; bed/path canvas editing ships in a follow-up.
- Q: When should plant placements be saved? → A: Auto-save on placement — each successful plant drop or move saves immediately with a brief confirmation.
- Q: Alternative to drag for placing plants? → A: Drag + click-to-place — user may select a plant then click a bed location to place it (same validation as drag).
- Q: Visual polish scope? → A: Full app refresh — apply the new visual system to every screen in the application.
- Q: Planting on phone-sized screens? → A: Click-to-place on phone — phone users place plants via select + tap; drag-and-drop remains tablet/desktop only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Drag-and-Drop Planting in Beds (Priority: P1)

A home gardener opens their garden plan and wants to add tomatoes to a raised bed. They
browse a plant list with recognizable names (and images where available), drag a tomato
onto the bed on the garden canvas, and see it appear exactly where they dropped it—with
spacing shown visually. They can drag an existing plant to a new spot in the same bed
without typing numbers or opening a coordinate form. If the spot is too close to another
plant or breaks compatibility rules, they see a clear visual warning before the placement
is accepted.

**Why this priority**: Manual X/Y coordinate entry is the primary usability failure
described by the user. Drag-and-drop planting is the core interaction that makes garden
planning feel natural and must work reliably before any visual polish matters.

**Independent Test**: Open a garden with at least one bed, drag three different plants
from the library onto the bed, reposition one plant, and confirm all placements save
correctly—without the user ever entering numeric position fields.

**Acceptance Scenarios**:

1. **Given** a garden with at least one plantable bed, **When** the user drags a plant
   from the plant library and drops it onto the bed, **Then** the plant appears at the
   drop location with its spacing footprint visible on the canvas and is saved immediately.
2. **Given** a plant is already placed in a bed, **When** the user drags that plant to
   a new location within the garden, **Then** the plant moves to the new location, the
   updated position is saved immediately, and a brief confirmation is shown—without
   coordinate input fields.
3. **Given** the user attempts to drop a plant outside any plantable bed or on a path,
   **When** they release the drag, **Then** the drop is rejected with a clear visual
   indicator and no placement is created.
4. **Given** a drop would violate spacing or incompatibility rules, **When** the user
   attempts to place the plant, **Then** the system blocks or clearly highlights the
   invalid placement with an understandable message—not a technical error.
5. **Given** a user is placing or moving a plant, **When** they interact with the
   canvas, **Then** no form asks them to enter X or Y coordinates for that planting.
6. **Given** a plant is selected in the library, **When** the user clicks a valid
   location on a plantable bed, **Then** the plant is placed at that click location,
   auto-saved, and validated with the same rules as drag-and-drop.

---

### User Story 2 - Readable, Professional Application Design (Priority: P2)

A gardener opens any screen in the application and immediately understands layout,
actions, and navigation. Buttons, links, and controls have sufficient color contrast
to read at a glance across the entire app—not only on the garden page. Panels, toolbars,
forms, and the planning canvas use a cohesive visual style that feels like a purpose-built
gardening application. Primary actions are visually distinct from secondary actions on
every screen.

**Why this priority**: The user explicitly reports poor color contrast and an unpolished
feel. A garden-page-only fix would leave jarring inconsistencies when navigating to
gardens list, plant catalog, settings, and other flows.

**Independent Test**: A reviewer with no prior knowledge of the app can identify primary
actions and navigation on the garden page, gardens list, and plant catalog within 30
seconds per screen; all interactive controls across the application pass standard
contrast checks.

**Acceptance Scenarios**:

1. **Given** a user views any screen in the application, **When** the page loads,
   **Then** interactive regions use consistent visual hierarchy, labeling, and spacing.
2. **Given** any button or link anywhere in the application, **When** measured against
   standard accessibility contrast guidelines, **Then** text and icon foreground colors
   meet at least WCAG 2.1 AA contrast against their backgrounds (4.5:1 for normal text,
   3:1 for large text and UI components).
3. **Given** a user hovers over or focuses an interactive control on any screen, **When**
   the control is active, **Then** a visible focus or hover state confirms which element
   is selected.
4. **Given** a user views the garden planner, **When** the page loads, **Then** the plant
   library, garden canvas, and detail/action areas are visually separated with clear
   headings or labels.
5. **Given** a user completes a common task (add a plant, browse catalog, save a garden),
   **When** they use only on-screen controls, **Then** each step has an obvious affordance
   on the relevant screen—not hidden behind coordinate forms or unclear styling.

---

### User Story 3 - Clear Guidance and Feedback During Planning (Priority: P3)

A first-time user opens an empty or partially configured garden and is not left guessing.
Empty beds show a short hint inviting them to drag plants from the library. During drag
operations, valid drop zones are highlighted. After save, a brief confirmation appears.
Validation problems use everyday language tied to gardening (e.g., "too close to your
peppers") rather than coordinate or system jargon.

**Why this priority**: Professional applications guide users through unfamiliar tasks.
Discoverability closes the gap between having drag-and-drop capability and users actually
finding and trusting it.

**Independent Test**: A new user with an empty bed completes their first plant placement
in under two minutes using only on-screen hints—no documentation or support required.

**Acceptance Scenarios**:

1. **Given** a bed has no plants, **When** the user views the canvas, **Then** a concise
   hint indicates they can drag or tap to add plants from the library.
2. **Given** the user is dragging a plant or has armed a plant for click-to-place, **When**
   the pointer is over a valid bed, **Then** that bed is visually highlighted as a drop
   target.
3. **Given** a validation failure occurs, **When** feedback is shown, **Then** the message
   names the plants or beds involved and avoids exposing raw coordinate values as the
   primary explanation.

*(Save confirmations for auto-saved placements are covered in User Story 1 / FR-015.)*

---

### Edge Cases

- What happens when the user drops a plant while offline? Show a clear message that
  the placement could not be saved until connectivity returns; revert the canvas to the
  last saved state—do not silently discard or falsely confirm success.
- What happens when drag-and-drop is unavailable (e.g., small phone screen)? Drag-and-drop
  is disabled on phone; users place plants via select + tap (click-to-place) on a bed
  location. Viewing, date edits, removal, and click-to-place remain available without
  coordinate entry.
- What happens when a bed is very small relative to plant spacing? Block placement with
  feedback that the bed is too small for the plant's required spacing.
- What happens when the user cancels mid-drag (Escape or drag outside window)? The plant
  returns to its origin (library or previous position) with no partial save.
- What happens when two users edit concurrently? Existing version-conflict handling
  applies; the user sees a review/overwrite dialog—not lost drag-and-drop work without
  explanation.
- What happens for indoor starts and transplants? Transplanting onto a bed uses drag-and-drop
  or click-on-bed at a specific location—not coordinate forms.
- What happens when a user click-places outside a bed or on invalid spacing? Same rejection
  and feedback as an invalid drag-and-drop—no placement is created or saved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to place new plants in plantable beds by dragging
  from a plant library and dropping onto the garden canvas, or by selecting a plant and
  clicking a valid location on a plantable bed.
- **FR-002**: System MUST allow users to reposition existing plants by dragging them on
  the canvas within the same garden; each successful move MUST persist immediately.
- **FR-003**: System MUST auto-save each successful plant drop, move, click-to-place, or
  transplant without requiring a separate Save action for placements.
- **FR-004**: System MUST NOT require users to enter X or Y coordinate values to create,
  move, or transplant a plant placement in any primary user workflow.
- **FR-005**: System MUST show a visual spacing footprint during drag and at rest for
  each placed plant so users understand occupied space without reading numeric positions.
- **FR-006**: System MUST reject drops outside plantable beds and on non-plantable areas
  (e.g., paths) with immediate visual feedback.
- **FR-007**: System MUST preserve existing spacing and incompatibility validation rules
  from the garden layout feature and apply them identically to drag-and-drop and
  click-to-place; invalid placements are blocked or clearly flagged before save.
- **FR-008**: System MUST meet WCAG 2.1 AA color contrast minimums for all text, buttons,
  links, and interactive controls across every screen in the application.
- **FR-009**: System MUST apply a cohesive visual design system (typography, color palette,
  button styles, form controls, focus states) consistently across all application screens.
- **FR-010**: System MUST present the garden planner with clearly labeled regions for plant
  selection, canvas editing, and item details—consistent with the application-wide design
  system.
- **FR-011**: System MUST provide visible hover and keyboard focus states for all
  interactive controls across the application.
- **FR-012**: System MUST display human-readable plant and bed names in the details panel
  when an item is selected; raw coordinate pairs MUST NOT be the primary information
  shown for a selected plant or structure.
- **FR-013**: System MUST show empty-state hints on beds without plants directing users
  to drag or click to add plants from the library.
- **FR-014**: System MUST highlight valid drop targets while the user is dragging a plant
  or has armed a plant for click-to-place.
- **FR-015**: System MUST show a brief success confirmation after each auto-saved
  placement and after any explicit garden save.
- **FR-016**: System MUST express validation errors in plain language referencing plant
  names, bed names, or gardening concepts—not coordinate tuples or internal field names.
- **FR-017**: System MUST support transplanting indoor starts onto a bed using drag-and-drop
  or click-on-bed at a specific location—without coordinate entry forms.
- **FR-018**: On phone-sized screens, system MUST support click-to-place planting
  (select plant, tap bed location) with the same validation as drag-and-drop; system
  MUST allow viewing the plan, inspecting details, editing dates, and removing items
  without coordinate forms. Drag-and-drop planting and repositioning remain tablet and
  desktop only.

### Key Entities

- **Garden Plan**: The user's saved garden with dimensions, beds, paths, and placements;
  the primary surface for this feature.
- **Plantable Bed**: A rectangular area within the garden that accepts plant drops;
  visually distinct from paths and garden boundary.
- **Plant Placement**: A single plant instance at a canvas position with spacing radius,
  planting date, and link to catalog plant; position is derived from user drag actions.
- **Plant Library Entry**: A selectable catalog plant shown with name and illustration
  (or category default) used as the drag source for new placements.
- **Canvas Interaction State**: Transient UI state during drag (drop preview, valid/invalid
  highlighting, target bed emphasis) that guides the user without persisting separately.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of usability-test participants place their first plant using drag-and-drop
  or click-to-place without assistance and without opening any coordinate input field.
- **SC-002**: A user can add three plants to a bed in under 3 minutes on first attempt
  (moderated task, tablet or desktop); each placement auto-saves without a manual Save step.
- **SC-003**: 100% of buttons and text labels across all application screens pass automated
  WCAG 2.1 AA contrast checks in acceptance testing.
- **SC-004**: 90% of usability-test participants correctly identify primary navigation and
  actions on the garden planner, gardens list, and plant catalog within 30 seconds per
  screen.
- **SC-005**: 85% of participants rate the application as "easy to use" or "professional"
  in post-task feedback (5-point scale, top two boxes)—evaluated across garden planning
  and at least two other core flows (e.g., gardens list, plant catalog).
- **SC-006**: Zero primary planting workflows require numeric X/Y input in acceptance
  test scripts covering direct seed, drag reposition, click-to-place, and indoor-start
  transplant.
- **SC-007**: When validation blocks a drop or tap placement, 90% of participants
  understand the reason from on-screen feedback alone without asking what "position_x"
  or similar terms mean.
- **SC-008**: On phone-sized screens in moderated testing, 100% of participants can
  place a plant via click-to-place and perform light edits (inspect details, change dates,
  remove an item) without coordinate forms or drag-and-drop.

## Assumptions

- This feature builds on existing garden layout (beds, paths, placements, validation) and
  visual planner capabilities already in the product; it closes the usability gap where
  coordinate-based forms and poor visual design remain exposed to users.
- Internal storage may continue to use numeric positions for persistence and validation;
  this spec requires those values to be computed from user drag actions, not typed in.
- Illustrated plant images and structure libraries from the visual planner feature are
  reused where available; this spec does not require new artwork beyond what the catalog
  already provides or category defaults.
- Spacing, incompatibility, climate, and crop-rotation validation behavior is unchanged
  in substance—only how users specify positions changes.
- Phone-sized screens support click-to-place planting and light edits; drag-and-drop
  planting and repositioning require tablet or desktop. Canvas bed/path drawing remains
  deferred.
- Canvas bed/path drawing, move, and resize (formerly User Story 3) are deferred to a
  follow-up feature; v1 retains existing bed/path editing workflows without requiring
  coordinate entry for plantings.
- Visual redesign applies to every in-app screen (gardens list, plant catalog, auth,
  settings, garden planner, etc.) with a single cohesive design system.
- Users are authenticated homeowners editing their own gardens; multi-user real-time
  collaboration is out of scope.

## Dependencies

- Existing garden layout model: areas (beds/paths), placements, indoor starts, versioning.
- Existing plant catalog with spacing and incompatibility data.
- Existing visual planner canvas and plant library components as the foundation for
  drag-and-drop interactions.

## Out of Scope

- Canvas draw, move, and resize for beds and paths (deferred to follow-up; v1 keeps
  existing bed/path editing forms).
- External marketing websites or third-party landing pages not served by the application.
- New plant catalog content, scheduling, shopping lists, or harvest tracking.
- 3D visualization, seasonal growth animation, or polygon/freehand bed shapes.
- User-uploaded plant images.
- Replacing validation rules or adding new horticultural constraints.
- Real-time collaborative editing with multiple cursors.
