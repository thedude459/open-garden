# Feature Specification: Plant Database

**Feature Branch**: `003-plant-database`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "Build the Plant Database feature for the garden planning system. This is the foundational horticultural knowledge engine described in the constitution (Principle I) — layout validation, task scheduling, and succession planting will all depend on this data later, so it needs to be structured and queryable, not just descriptive text."

## Clarifications

### Session 2026-06-12

- Q: How should users provide their location for climate filtering in this feature? → A: Include minimal location capture in this feature (city or postal code) when the user first enables climate filtering.
- Q: When a companion/incompatible plant is referenced but not yet in the server-side catalog, how should the system handle it? → A: Auto-create a minimal stub catalog entry for the missing companion (name + type only), marked incomplete, so the relationship is immediately queryable by ID.
- Q: Where should provisional plant records be stored? → A: Device-local only — provisional plants persist on the user's device; not shared across devices or users. *(Superseded by persistence review below.)*
- Q: What is the catalog sync strategy? → A: Full catalog bulk download on first sync; periodic background refresh when online. *(Superseded — see server-scheduled sync + scoped client cache below.)*
- Q: What is the default climate compatibility filter behavior? → A: Hard exclude — incompatible plants are hidden from search/browse results when the filter is active.
- Q: What is the overall persistence model for this feature? → A: Server stores authoritative catalog as a **shared** database; provisional plants and saved location are **per-user**. All catalog access requires authentication.
- Q: Is sign-in required to search and browse the authoritative plant catalog? → A: Sign-in required for all catalog access — search, browse, and detail pages.
- Q: What is the minimum authentication method for this feature? → A: Email and password — users register with email/password and sign in with the same.
- Q: When and how is the authoritative catalog synced? → A: Server syncs from the external provider on a schedule; clients cache a **scoped subset** (garden-pinned + recently viewed plants) from the server API into IndexedDB for offline use. Full catalog search/browse requires network.
- Q: How should non-organic fertilizer data from the external provider be handled during ingestion? → A: Filter out — non-organic fertilizer recommendations are removed during ingestion; only organic guidance is stored.
- Q: When a user confirms linking their provisional plant to a newly available authoritative catalog match, what happens? → A: Merge fields — authoritative data fills gaps; user-entered values retained where authoritative data is missing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search and Browse the Plant Catalog (Priority: P1)

A signed-in home gardener opens the plant catalog to find crops they want to
grow. They search by common name (e.g., "tomato"), browse by plant type
(vegetable, herb, fruit tree), or scan a paginated list. Results show enough
summary information (name, type, days to maturity) to choose a plant before
opening its full record.

**Why this priority**: Discovery is the entry point for all downstream garden
planning. Without search and browse, no other feature can consume plant data.

**Independent Test**: Can be fully tested online by searching and browsing via
the server API after sign-in. Offline: scoped search/detail within the IndexedDB
cache subset (pinned + recently viewed plants) after cache population.

**Acceptance Scenarios**:

1. **Given** a signed-in user with network connectivity, **When** the user
   searches by common name, **Then** matching plants from the full server catalog
   appear ranked by relevance with name and plant type visible.
2. **Given** a signed-in user with network connectivity and the catalog contains
   multiple plant categories, **When** the user browses by type (e.g., herbs),
   **Then** only plants of that type are shown from the server catalog.
3. **Given** a signed-in user searches by botanical name, **When** a match exists
   in the server catalog, **Then** the corresponding plant appears in results.
4. **Given** a signed-in user filters by growing condition (sun exposure or
   spacing need), **When** plants match those criteria, **Then** only qualifying
   plants are returned from the server catalog.
5. **Given** a signed-in user is offline and a plant is in their scoped offline
   cache (pinned or recently viewed), **When** they view that plant's detail or
   search within the cached subset, **Then** results are served from IndexedDB
   without network. Full-catalog search while offline shows an offline banner
   and is unavailable.
6. **Given** a user is not signed in, **When** they attempt to access the plant
   catalog, **Then** the system redirects them to sign in or register (email and
   password) before search, browse, or detail views are available.

---

### User Story 2 - View Complete Plant Details (Priority: P2)

After finding a plant, the user opens its detail page to review all
horticultural attributes needed for future planning: names, variety info, maturity
timeline, seed-start and planting rules, spacing, watering and fertilizer needs,
companions and incompatibles, pest/disease notes, harvest window, and (for trees)
rootstock options and mature size.

**Why this priority**: Structured, complete plant records are the core deliverable
of Principle I. Downstream features (layout validation, scheduling) depend on
queryable fields — not prose descriptions.

**Independent Test**: Can be tested by opening any catalog plant and verifying
every required field is present, structured, and readable — independent of
layout or task features.

**Acceptance Scenarios**:

1. **Given** a signed-in user and a plant exists in the catalog, **When** the
   user opens its detail page, **Then** all required fields (botanical name,
   common name, variety, days to maturity, seed-start window, transplant/direct-seed
   rules, spacing, watering, fertilizer, companions, incompatibles, pest/disease
   notes, harvest window) are displayed.
2. **Given** a plant is a tree, **When** a user views its detail page, **Then**
   rootstock options and mature size are displayed in addition to standard fields.
3. **Given** a plant has companion relationships, **When** a user views the
   detail page, **Then** companions and incompatibles appear as structured,
   linked references to other catalog plants (not free-text only).
4. **Given** a companion plant is referenced, **When** the user selects it,
   **Then** they navigate to that plant's detail page.

---

### User Story 3 - Filter by Climate Compatibility (Priority: P3)

A gardener with a saved location wants to see only plants suitable for their
climate. They apply a climate-zone or frost-date compatibility filter that
**hard-excludes** plants whose planting windows do not align with their local
conditions — incompatible plants are removed from search and browse results
while the filter is active.

**Why this priority**: Climate-aware filtering prevents users from selecting
plants they cannot successfully grow, aligning with the constitution's location
and climate integration requirements.

**Independent Test**: Can be tested by setting a saved location, applying the
climate filter, and verifying that included/excluded plants match expected
frost-date and zone compatibility rules.

**Acceptance Scenarios**:

1. **Given** a signed-in user has a saved location with a known climate zone
   and frost dates, **When** they enable climate compatibility filtering,
   **Then** the catalog hard-excludes plants whose planting windows do not
   overlap their local growing season (incompatible plants are not shown in
   results).
2. **Given** climate filtering is active, **When** a user views a plant detail
   page, **Then** the plant's seed-start, transplant, and direct-seed windows
   are contextualized for the user's location (e.g., recommended date ranges).
3. **Given** a signed-in user has not configured a saved location, **When** they
   attempt climate filtering, **Then** the system prompts them to enter a city
   or postal code, resolves frost dates and climate zone from that input, saves
   the location to their account, and then applies the filter.
4. **Given** a signed-in user has previously saved a location, **When** they
   enable climate filtering again (including on a different device), **Then** the
   saved location is used without re-prompting.

---

### User Story 4 - Handle Plants Not in the External Catalog (Priority: P4)

A gardener searches for a specific variety not found in the external plant data
source. Instead of being blocked, they are offered a fallback path to create a
provisional plant record with the minimum horticultural fields needed for future
planning features, clearly marked as user-provided.

**Why this priority**: Incomplete external catalogs are inevitable. A fallback
prevents dead-ends and keeps the garden planning workflow unblocked.

**Independent Test**: Can be tested by searching for a non-existent plant, creating
a provisional record while signed in, and verifying it is stored on the server
under the user's account and discoverable in future searches from any signed-in
session — without requiring external API data.

**Acceptance Scenarios**:

1. **Given** a signed-in user's search returns no results, **When** they choose
   to add the plant manually, **Then** they can create a provisional record with
   required fields (at minimum: common name, plant type, spacing, and days to
   maturity).
2. **Given** a provisional plant is created, **When** it is saved, **Then** it
   is persisted on the server under the authenticated user's account, marked as
   user-provided, and appears in that user's search results.
3. **Given** a provisional plant exists for a user, **When** they sign in on a
   different device, **Then** the provisional plant appears in their catalog.
4. **Given** a provisional plant exists, **When** a user views its detail page,
   **Then** a clear indicator shows it is not sourced from the authoritative
   catalog and which fields may be incomplete.
5. **Given** the external catalog later adds a matching plant, **When** a sync
   occurs, **Then** the system notifies the user and does not silently overwrite
   the provisional record.
6. **Given** a user is notified of an authoritative catalog match for their
   provisional plant, **When** they confirm linking, **Then** authoritative
   data fills missing fields and user-entered values are retained where the
   authoritative record lacks data; the record is marked as linked to the
   authoritative catalog entry.
7. **Given** a user is not signed in, **When** they attempt to create a
   provisional plant, **Then** the system prompts them to sign in or register
   before saving.

---

### Edge Cases

- What happens when the external data provider is unavailable during a sync
  attempt? The server continues serving the last successful authoritative
  catalog; online clients are unaffected. Scoped offline cache may be stale;
  users are informed the catalog may be outdated.
- How does the system handle plants with partially missing fields from the
  external source (e.g., companions listed but spacing absent)? Missing fields
  are stored as null/empty, flagged on the detail page, and excluded from
  filters that depend on the missing attribute.
- What happens when two varieties share the same common name? Results show both
  with distinguishing variety or botanical name information.
- What happens when a tree record lacks rootstock data from the external source?
  Rootstock fields display as unavailable; the plant remains in the catalog with
  a visible data-gap indicator.
- What happens when the scoped offline cache is empty on first sign-in with no
  network? Online catalog is unavailable without network; user sees guidance to
  connect. Previously cached plants (returning user) remain available offline.
- What happens during scoped offline cache download? After sign-in, the client
  downloads the cache bundle (pinned + recently viewed plants) from the server.
  Cached plant detail pages work offline once complete; full-catalog search
  requires network.
- What happens when the server-side external provider sync fails? The server
  continues serving the last successful authoritative catalog; clients cache
  from that stale server data and users are informed the catalog may be outdated.
- What happens when a user-provided provisional plant has incomplete companion
  data? It is stored and searchable; companion/incompatible fields remain empty
  until the user or a future sync fills them.
- What happens when a companion reference points to a plant not yet in the local
  catalog? A stub plant entry is auto-created with name and type, marked
  incomplete; the relationship links by stub ID and the stub is enriched when
  full provider data syncs later.
- What happens when the external source provides only non-organic fertilizer
  recommendations for a plant? The fertilizer field is stored as empty/null with
  a data-gap indicator on the detail page; non-organic content is not persisted.
- What happens when a signed-in user creates a provisional plant on one device
  and opens the app on another? The provisional plant is available after
  authentication on the second device because it is server-persisted per account.
- What happens when the external catalog adds a match for a user's provisional
  plant? The user is notified; if they confirm linking, authoritative data fills
  missing fields and user-entered values are kept where authoritative data is
  absent; the record is linked to the authoritative entry without silent
  overwrite.
- What happens when an unauthenticated user attempts to access the catalog or
  save user-specific data (provisional plant, location)? The system redirects to
  sign-in or registration; no catalog content is shown and no user data is
  persisted until authenticated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ingest plant data from an external authoritative plant
  data provider and normalize it into a structured server-side catalog.
- **FR-002**: System MUST maintain a scoped offline cache (IndexedDB via service
  worker) containing garden-pinned and recently viewed plants so those detail
  views and subset search work offline. Full-catalog search and browse require
  network connectivity and use the server-side catalog.
- **FR-003**: System MUST support plant categories including vegetables, herbs,
  fruits, berries, fruit trees, nut trees, shrubs, cover crops, companion
  flowers, and permaculture guild plants.
- **FR-004**: Each plant record MUST store structured fields for: botanical name,
  common name, varietal information, days to maturity, indoor seed-starting
  window, transplanting rules, direct-seeding rules, spacing requirements,
  watering needs, fertilizer needs, companion plants, incompatible plants, pest
  and disease notes, and harvest window.
- **FR-005**: Tree records MUST additionally store rootstock options and mature
  size as structured fields.
- **FR-006**: Companion and incompatible relationships MUST be stored as
  structured, queryable references to other plant records (not prose-only).
- **FR-006a**: When a referenced companion or incompatible plant is not yet in
  the server-side catalog, the system MUST auto-create a minimal stub catalog entry
  (common name and plant type at minimum), mark it as incomplete, and link the
  relationship by plant ID immediately.
- **FR-007**: Signed-in users MUST be able to search plants by common name,
  botanical name, plant type, sun exposure, and spacing needs.
- **FR-008**: Signed-in users MUST be able to browse the catalog by plant type
  with paginated or scrollable results.
- **FR-009**: Signed-in users MUST be able to view a full plant detail page
  showing all fields defined in FR-004 and FR-005.
- **FR-009a**: Unauthenticated users MUST NOT access catalog search, browse, or
  detail views; the system MUST redirect them to sign in or register.
- **FR-010**: Users MUST be able to filter catalog results by climate zone or
  frost-date compatibility based on a saved user location. When active, the
  filter MUST hard-exclude plants whose planting windows do not overlap the
  user's local frost-date range from search and browse results.
- **FR-010a**: When a signed-in user first enables climate filtering without a
  saved location, the system MUST prompt for a city or postal code, resolve frost
  dates and climate zone from that input, persist the location to the user's
  account, and apply the filter.
- **FR-011**: The server MUST refresh authoritative catalog data from the external
  provider on a scheduled basis when online, without blocking read access to the
  existing server-side catalog or client cache.
- **FR-011a**: After sign-in, the client MUST download a scoped offline cache
  bundle (garden-pinned + recently viewed plants) from the server API into
  IndexedDB. Full-catalog search and browse remain online-only against the server.
- **FR-011b**: The server MUST NOT require each client to call the external
  provider directly; external ingestion is server-side only.
- **FR-011c**: When online, the client MUST periodically refresh its scoped
  offline cache from the server API without blocking read access to the existing
  IndexedDB cache.
- **FR-012**: When a plant is not found in the external catalog, signed-in users
  MUST be able to create a provisional user-provided plant record so planning is
  not blocked.
- **FR-012a**: Provisional plant records MUST be persisted on the server and
  scoped to the authenticated user's account; they MUST be accessible across
  devices when the same user signs in.
- **FR-012b**: Users MUST authenticate via email and password before accessing
  the plant catalog (search, browse, detail), creating or modifying provisional
  plant records, or saving location preferences.
- **FR-012c**: Users MUST be able to register a new account with email and
  password and sign in with the same credentials.
- **FR-013**: Provisional plant records MUST be visually distinguishable from
  authoritative catalog records wherever displayed.
- **FR-014**: System MUST NOT silently overwrite user-provided provisional
  records when external catalog data is refreshed.
- **FR-014a**: When a user confirms linking a provisional plant to a matching
  authoritative catalog entry, the system MUST merge fields: authoritative data
  fills gaps and user-entered values MUST be retained where authoritative data
  is missing; the record MUST be linked to the authoritative catalog entry.
- **FR-015**: System MUST expose plant data through a queryable interface
  suitable for consumption by future features (layout validation, task
  scheduling, succession planting) without requiring UI interaction. This
  includes a shared server-side query module (`lib/catalog/query.ts`) and
  documented HTTP endpoints for plant detail, relationships, and rootstocks.
- **FR-016**: System MUST flag records or fields with incomplete data from the
  external source so downstream features can handle gaps appropriately.
- **FR-017**: During server-side ingestion, the system MUST filter out
  non-organic fertilizer recommendations from the external provider; only
  organic-aligned fertilizer guidance MUST be stored in plant records.

### Key Entities

- **Plant**: A catalog entry representing a growable species or variety. Core
  attributes include names, type/category, maturity and planting windows, spacing,
  care needs, harvest window, and data-source provenance (authoritative vs.
  user-provided).
- **Plant Relationship**: A structured link between two plants indicating
  companion or incompatible status, queryable by either plant in the pair. If
  the target plant is missing at ingestion time, a stub plant record is created
  first so the relationship always resolves to a plant ID.
- **Plant Category**: A classification grouping (vegetable, herb, fruit tree,
  etc.) used for browse and filter operations.
- **Rootstock Option** (trees only): A structured sub-record describing
  rootstock name, vigor implications, and associated mature size/spacing.
- **Catalog Sync State**: Metadata tracking last successful server-side external
  sync, last client cache refresh from server, provider version, and cache
  freshness for offline and stale-data handling.
- **User Account**: An authenticated user identity (email and password
  registration) that scopes server-persisted provisional plants and saved location
  preferences.
- **User Location**: The user's saved climate context (city or postal code,
  resolved climate zone, frost dates) persisted on the server under the user's
  account when climate filtering is first enabled and reused on subsequent
  signed-in sessions.
- **Provisional Plant**: A user-created catalog entry with minimum required
  horticultural fields, persisted on the server under the authenticated user's
  account, and marked as non-authoritative. Accessible across devices for the
  same user.
- **Stub Plant**: A system-created minimal catalog entry (common name and plant
  type) generated when a companion/incompatible reference targets a plant not yet
  in the catalog. Marked incomplete; enriched when full provider data arrives on
  a later sync.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Signed-in users can find a known plant by common name in under 10
  seconds from the catalog home screen.
- **SC-002**: 100% of authoritative catalog plants render all FR-004 field slots;
  tree records additionally render FR-005 field slots. Fields without source
  data display data-gap indicators rather than omitted rows.
- **SC-003**: Scoped offline cache plants (pinned + recently viewed) support
  detail view and subset search offline after cache population, with no failed
  lookups for cached plant IDs. Full-catalog search requires network.
- **SC-004**: Companion and incompatible relationships are queryable programmatically
  for any plant with relationship data — verified by retrieving linked plant IDs
  without parsing display text.
- **SC-005**: Climate compatibility filtering correctly excludes at least 95% of
  plants whose planting windows do not overlap the user's local frost-date range
  (validated against a reference set of test plants).
- **SC-006**: When a signed-in user's search returns no results, they can create
  a provisional plant and find it again via search in under 2 minutes, including
  from a different device after signing in.
- **SC-007**: Catalog supports at least 500 plant records without search results
  degrading noticeably (under 2 seconds to display results).

## Assumptions

- Authoritative plant data is ingested from **Trefle** and **Perenual** APIs
  (see `specs/001-plant-database/plan.md`) on a scheduled basis into a **shared**
  Postgres catalog; provider fields are normalized server-side. Companion/incompatible
  relationships and rootstock options are curated reference data, not provider fields.
  Clients cache a **scoped subset** (garden-pinned + recently viewed plants) into
  IndexedDB for offline detail/subset-search; full-catalog search and browse are
  online-only via the server API.
- Users MUST register and sign in with email and password before accessing any
  plant catalog features (search, browse, detail, climate filter, provisional
  plants).
- Users provide a saved location (city or postal code) within this feature the
  first time they enable climate filtering; the resolved zone and frost dates are
  persisted to the user's server account for reuse across devices.
- Provisional plant minimum required fields are: common name, plant type, spacing
  requirements, and days to maturity; all other fields are optional at creation.
  Provisional plants are server-persisted per authenticated user account.
- Garden layout placement, bed design, orientation tools, and task schedule
  generation are explicitly out of scope and will consume this data in separate
  features.
- Organic and safety constraints from the constitution apply to fertilizer field
  content sourced from the external provider; non-organic fertilizer
  recommendations are filtered out during server-side ingestion and are not
  stored in plant records.

## Out of Scope

- Garden layout and bed/orientation design
- Plant placement on a garden map or bed canvas
- Task schedule generation (watering, fertilizing, weeding, harvest, succession)
- Orchard guild layout and understory placement validation
- Advanced account management (password reset flows, email verification, social
  login, admin user management) beyond email/password registration and sign-in
  required to scope plant and location data per user
