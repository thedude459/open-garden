# Feature Specification: Visual Garden Planner Experience

**Feature Branch**: `005-visual-planner-ui`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "I want the look and feel of the UI to be more like this app - https://www.growveg.com/garden-planner-intro.aspx. I want it to have images for things and be able to plan an entire garden, orchard or other types of growing areas."

## Clarifications

### Session 2026-07-05

- Q: Which growing-area type should be the third supported type in v1 (alongside vegetable garden and orchard)? → A: Container / patio garden
- Q: How should plant images be sourced for the visual planner? → A: Curated illustrations only (licensed/original artwork per plant or category; no user uploads in v1)
- Q: How deep should orchard planning be in v1? → A: Full validation — canopy footprints plus hard-block tree spacing and rootstock rules where catalog data exists
- Q: How should existing gardens adopt the new visual planner? → A: Auto-upgrade on open — existing plans open in the visual planner with layout data mapped automatically and default illustrations applied
- Q: What level of layout editing should work on mobile (phone-sized screens) in v1? → A: View + light edits — phone supports viewing, plant details, dates, and delete; drag-and-drop layout on tablet/desktop only

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Layout Planning with Plant Images (Priority: P1)

A home gardener opens the planner and sees a rich, illustrated canvas—not abstract
shapes alone. They drag plants from a visual catalog (showing recognizable images or
illustrations) onto beds, see spacing represented visually, and rearrange items until
the layout feels right. Paths, beds, and placed plants are distinguishable at a glance
without reading labels.

**Why this priority**: The core ask is a GrowVeg-like visual experience. Without
illustrated plants and a drag-and-drop canvas, the feature does not deliver its primary
value over the current functional-but-minimal layout editor.

**Independent Test**: Create a new plan, add two beds, drag three different plants
(with visible images) onto the canvas, reposition one plant, and confirm the layout
is readable without opening detail panels. Canvas supports pointer/touch pan and
scroll-wheel zoom via VisualCanvas; toolbar +/- zoom controls ship in US5 (FR-010).

**Acceptance Scenarios**:

1. **Given** a user is editing a growing-area plan, **When** they browse the plant
   picker, **Then** each plant shows a recognizable image or illustration (not text-only).
2. **Given** a plant is selected in the picker, **When** the user drags it onto a
   valid bed location, **Then** the plant appears on the canvas with its image and
   spacing footprint visible.
3. **Given** plants are already placed, **When** the user drags a plant to a new
   position within the same bed, **Then** the canvas updates immediately and spacing
   feedback is shown visually.
4. **Given** a placement would violate spacing or incompatibility rules, **When** the
   user attempts to drop the plant, **Then** the drop is blocked or clearly highlighted
   as invalid before save.

---

### User Story 2 - Plan Different Growing-Area Types (Priority: P2)

A user creating a new plan chooses what kind of growing area they are designing—
vegetable garden, orchard, or container / patio garden. Each type presents appropriate
defaults, structure options, and plant categories. An orchard plan supports tree
placements with canopy representation; a vegetable garden emphasizes beds and rows;
a container / patio garden emphasizes pots and small-space layouts.

**Why this priority**: The user explicitly wants to plan gardens, orchards, and other
growing areas—not only rectangular vegetable beds. This expands the product toward
constitution goals while keeping the visual planner meaningful for diverse users.

**Independent Test**: Create three plans of different growing-area types; verify
zone_type persists, plant library filters differ, and orchard hard-blocks invalid
tree spacing. Structure canvas placement verified in US3.

**Acceptance Scenarios**:

1. **Given** a user starts a new plan, **When** they choose growing-area type
   "vegetable garden", **Then** the plant library and structure library (when available)
   prioritize vegetable-garden categories, and orchard-only options are hidden.
2. **Given** a user starts a new plan, **When** they choose growing-area type
   "orchard", **Then** they can place tree illustrations with canopy-sized footprints
   and the system hard-blocks placements that violate tree spacing or rootstock rules
   when catalog data exists.
3. **Given** a user starts a new plan, **When** they choose growing-area type
   "container / patio garden", **Then** the plant library emphasizes small-space
   categories and the structure library (US3) shows container-specific items first.

---

### User Story 3 - Structures and Objects with Visual Library (Priority: P3)

A user adds non-plant elements—raised beds, greenhouses, trellises, paths, seating,
water features, or animal enclosures—from a visual object library. Each object appears
on the canvas as an illustration or icon scaled to the plan. Objects can be moved,
resized within allowed constraints, and layered relative to plants.

**Why this priority**: GrowVeg's appeal includes planning the full space (not just
crops). Structures give context, help beginners, and make plans shareable and
recognizable.

**Independent Test**: Add a greenhouse, trellis, and path to a plan; move the greenhouse;
confirm all three render as distinct visual objects on the canvas.

**Acceptance Scenarios**:

1. **Given** a user is editing a plan, **When** they open the structure library,
   **Then** available items show preview images grouped by category (beds, protection,
   vertical support, access, etc.).
2. **Given** a structure is selected, **When** the user places it on the canvas,
   **Then** it renders at proportional size with a recognizable illustration.
3. **Given** overlapping objects exist, **When** the user sends an item backward or
   forward, **Then** layering order updates on the canvas without losing placement data.
4. **Given** a structure affects growing conditions (e.g., season-extending cover),
   **When** it is placed, **Then** the system records that association for downstream
   scheduling features (display only in this feature; scheduling logic is out of scope).

---

### User Story 4 - Start from Visual Templates (Priority: P4)

A beginner chooses a starter template (e.g., "Beginner Garden", "Small Orchard",
"Balcony Containers") from a gallery of illustrated previews. The template loads a
pre-arranged layout they can customize. Experienced users can still start from blank.

**Why this priority**: GrowVeg emphasizes quick starts and template galleries; this
lowers time-to-first-plan and matches user expectations for a polished planner product.

**Independent Test**: Select "Beginner Garden" template, confirm beds and sample plants
appear with images, replace one plant, and save. Thumbnail list preview verified in US5.

**Acceptance Scenarios**:

1. **Given** a new user opens plan creation, **When** they view templates,
   **Then** each template shows a name, short description, and preview image.
2. **Given** a user selects a template, **When** it loads, **Then** the canvas shows
   a complete starter layout with illustrated plants and structures.
3. **Given** a template-based plan, **When** the user modifies any element,
   **Then** changes persist as their own plan without breaking validation rules.

---

### User Story 5 - Polished Planner Chrome and Plan Overview (Priority: P5)

The planner screens use cohesive visual design: clear toolbar, left/right panels for
library and details, zoom and pan on the canvas, and a plan overview that feels
purpose-built for gardening (not a generic form UI). Users can zoom to fine-tune plant
positions and zoom out to see the whole property at once.

**Why this priority**: "Look and feel" spans the full experience—not only canvas
content. Navigation, density, and visual hierarchy must match user expectations set
by mature garden planners.

**Independent Test**: Complete a 15-minute planning session using only planner UI
controls (no browser zoom); user can add plants, structures, zoom/pan, and save without
confusion about which panel to use.

**Acceptance Scenarios**:

1. **Given** a user opens the planner, **When** the page loads,
   **Then** library, canvas, and property/detail regions are visually distinct and
   labeled for gardening tasks.
2. **Given** a large plan, **When** the user zooms and pans,
   **Then** they can navigate the full area while plant images remain legible at
   common zoom levels.
3. **Given** a saved plan, **When** the user returns later,
   **Then** the visual layout, images, and layer order restore exactly as saved.
4. **Given** a saved plan, **When** the user views the plan list,
   **Then** each entry shows its growing-area type badge and a visual thumbnail preview
   that updates after save.

---

### Edge Cases

- What happens when a plant has no catalog image? Show a category-appropriate default
  illustration and the plant name on hover or select—not a broken image.
- What happens when a user adds many plants (50+)? Canvas remains navigable via zoom/pan;
  performance does not block basic editing (see SC-003a).
- What happens when an existing pre-visual plan is opened? It auto-upgrades to the
  visual planner: all beds, paths, and placements render with illustrations; no manual
  migration step required.
- What happens when switching growing-area type on an existing plan? System warns that
  type change may invalidate some placements; user confirms before incompatible items
  are removed or flagged.
- What happens on small screens (phone)? Users can view the full illustrated plan,
  inspect plant details, edit dates, and remove items; drag-and-drop layout editing
  (plants, structures, repositioning) requires tablet or desktop in v1.
- What happens when validation blocks placement? Visual error state on canvas and in
  panel—user understands why without reading technical messages.
- What happens when orchard catalog data is incomplete (no rootstock or spacing)?
  Allow placement with category default canopy footprint; hard-block applies only when
  catalog provides spacing/rootstock data—never allow override of known invalid spacing.
- What happens for provisional/custom plants without images? Show a category-appropriate
  default illustration keyed to plant type—not a broken image or user-upload prompt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present the layout editor as a visual, image-rich planning
  canvas inspired by mature garden-planner products (e.g., drag-and-drop, illustrated
  plants, proportional scaling)—not text-only or wireframe-only representation.
- **FR-002**: System MUST display a curated illustration for each catalog plant in the
  picker and on the canvas when placed; user-uploaded plant images are out of scope for v1.
- **FR-003**: System MUST support drag-and-drop placement and repositioning of plants
  on the canvas, preserving existing spacing and incompatibility validation behavior
  from the garden layout feature.
- **FR-004**: System MUST allow users to create and manage plans for three growing-area
  types in v1: vegetable garden, orchard, and container / patio garden.
- **FR-005**: System MUST adapt available structures, plant category emphasis, and
  starter layout options based on the selected growing-area type. For v1, "default layouts"
  means: (a) zone-filtered library content, (b) optional starter templates per zone type
  (FR-008), and (c) a zone-aware empty-state hint on blank canvas—not auto-generated
  layouts on every new plan.
- **FR-006**: System MUST provide a visual library of structures and objects (beds, paths,
  vertical supports, season-extending covers, and other common garden elements) each with
  a preview image and canvas illustration.
- **FR-007**: System MUST support layering order for canvas objects (send backward /
  forward) and optional locking to prevent accidental moves.
- **FR-008**: System MUST offer starter templates with illustrated preview thumbnails
  and pre-populated layouts users can customize.
- **FR-009**: System MUST generate and display a visual thumbnail preview for each saved
  plan in list and overview views.
- **FR-010**: System MUST provide zoom and pan controls on the planning canvas so users
  can work on small areas and view the full plan. v1 delivery: canvas transform in US1
  (wheel/pinch/pan); toolbar zoom buttons in US5.
- **FR-011**: System MUST use consistent visual design across planner screens (toolbar,
  panels, canvas, dialogs) per contracts/planner-ui.md design tokens and layout regions.
  Acceptance: quickstart.md Visual Polish Checklist passes with zero blocking UX gaps.
- **FR-012**: When a plant lacks specific artwork (see FR-002), system MUST show a category
  default illustration keyed by plant category (vegetable, herb, fruit, tree, flower, etc.);
  user image uploads are not supported in v1.
- **FR-013**: System MUST retain all existing plan data (beds, paths, placements, indoor
  starts, history) when upgrading a plan to the visual planner; no user data loss on
  migration. Existing plans MUST auto-upgrade to the visual planner on open—layout data
  maps automatically and catalog plants receive default or specific illustrations without
  user action. Visual upgrade MUST preserve all 002 editor workflows (bed/path editing,
  indoor starts, garden settings, optimistic conflict resolution) within PlannerShell—not
  data-only migration.
- **FR-014**: Orchard-type plans MUST represent trees with canopy-sized footprints and
  MUST hard-block placements that violate tree spacing or rootstock rules from the
  knowledge engine when catalog data exists; advisory-only orchard validation is not
  permitted when required data is available.
- **FR-014a**: When a user selects or places a tree in an orchard plan, the system MUST
  display advisory companion and understory guild suggestions from the catalog knowledge
  engine (names + brief rationale). Suggestions are informational only—not placement
  requirements. Full guild layout designer UI remains deferred.
- **FR-015**: System MUST NOT require users to download or install separate software;
  the visual planner works in the user's browser like the rest of the application.
- **FR-016**: Visual styling MUST be original to this product— inspired by industry-leading
  garden planners but not copying proprietary assets, branding, or exact UI layouts from
  third parties.
- **FR-017**: On phone-sized screens, users MUST be able to view illustrated plans,
  inspect item details, edit planting dates, and remove plants or structures; drag-and-drop
  layout editing MUST be available on tablet and desktop only in v1.

### Key Entities

- **Growing-Area Plan**: A user's saved design with type (vegetable garden, orchard,
  container / patio garden), dimensions, visual thumbnail, and canvas objects; extends
  existing garden entity concept.
- **Visual Plant Representation**: Link between a catalog or provisional plant and its
  display image, spacing footprint shape, and canvas render metadata.
- **Structure Object**: A non-plant canvas item (bed frame, greenhouse, trellis, path,
  etc.) with illustration, dimensions, and optional environmental effect tags.
- **Plan Template**: A reusable starter layout with preview image, target growing-area
  type, and pre-placed structures/plants.
- **Canvas Layer**: Ordering group for plants and structures; supports lock state.
- **Plan Thumbnail**: Reduced visual snapshot of the canvas for lists and sharing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can select a starter template and customize it to include at least
  three illustrated plants and one structure in under 20 minutes without assistance.
- **SC-002**: 90% of usability-test participants correctly identify what each placed item
  is (plant vs structure vs path) from the canvas alone without opening detail panels.
- **SC-003a**: Plans with 50 placed items remain editable with zoom/pan; drag-and-drop
  pointer-up to re-render completes in < 100ms p95 on a mid-range laptop (T062 bench).
- **SC-003b**: In moderated usability testing, participants report no blocking lag during
  drag-and-drop (qualitative; tracked outside automated CI).
- **SC-004**: 100% of catalog plants shown in the picker have either a specific image or
  a category default illustration—never a broken or empty image placeholder.
- **SC-005**: Users can create and save at least one plan each for vegetable garden,
  orchard, and container / patio garden in a single session.
- **SC-006**: Existing plans created before this feature remain openable and visually
  rendered after migration, with zero data loss in acceptance testing.
- **SC-007**: User satisfaction survey (or structured feedback) rates the planner as
  "easier to use" or "more visual" compared to the pre-feature layout editor for 80%+
  of participants.
- **SC-008**: On phone-sized screens in moderated testing, 100% of participants can view
  an illustrated plan and perform light edits (inspect details, change dates, remove an
  item) without needing drag-and-drop layout controls.

## Assumptions

- This feature builds on the existing garden layout and plant catalog capabilities
  (Feature 001 plant database, Feature 002 garden layout and placement validation)—
  it is a visual and product-expansion layer, not a replacement of validation rules.
- GrowVeg is a **design reference** for interaction patterns and polish level, not a
  feature parity checklist; live chat, subscription marketing pages, garden journal,
  and email reminder systems are out of scope for this specification.
- Plant images MUST come from a curated illustration library (licensed or original
  artwork) aligned to the catalog, with category fallbacks; user-uploaded images and
  photorealistic photo catalogs are out of scope for v1.
- "Other growing areas" in v1 is **container / patio garden** — pots, planters, and
  raised containers for decks, balconies, and small spaces. Greenhouse and mixed
  permaculture patches are deferred; structure library items may overlap where useful.
- Orchard planning in v1 includes full validation (hard blocks) plus **advisory**
  companion/understory suggestions per constitution Principle II; permaculture guild
  *designer* UI (drag-to-build guilds) remains deferred.
- Scheduling, shopping lists, succession planting timelines, and personalized calendars
  remain separate features—this spec covers visual planning and multi-type layouts only.
- Mobile support in v1: phone-sized screens support view, detail inspection, date edits,
  and delete only; drag-and-drop layout editing is tablet and desktop only.
- Existing gardens from Feature 002 auto-upgrade to the visual planner on open; there
  is no separate legacy editor or opt-in migration flow in v1.
- Users are authenticated homeowners planning personal growing spaces; multi-user
  collaborative editing and public plan sharing galleries are out of scope unless added
  in a future spec.

## Dependencies

- Existing plant catalog with spacing, incompatibility, climate, and (future) rotation data.
- Existing garden layout model: areas, placements, indoor starts, planting history, versioning.
- Constitution principles I (knowledge engine) and II (layout validation)—especially
  tree spacing hard blocks and companion/guild advisory suggestions for orchard plans.

## Out of Scope

- Marketing landing pages, testimonials, or subscription flows mirroring GrowVeg's website.
- Garden journal, harvest tracking, photo diary, and note-taking (future feature).
- Email/SMS planting reminders and personalized calendar generation (future feature).
- Live expert chat or community garden gallery/sharing marketplace.
- Non-rectangular polygon bed shapes and freehand drawing of bed boundaries (future).
- 3D or seasonal time-lapse visualization of plant growth stages.
- User-uploaded plant or structure images (future enhancement).
- Legacy/classic layout editor as a parallel or fallback view (future only if needed).
- Importing GrowVeg plan files or other third-party planner formats.
