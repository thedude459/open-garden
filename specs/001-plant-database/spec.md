# Feature Specification: Plant Database

**Feature Branch**: `001-plant-database`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Build a Plant Database feature that lets a user search and browse a catalog of garden plants. Each plant entry includes common name, species, growing zone range, sun requirements, water needs, days to maturity, and spacing requirements. Plant data is sourced from an external provider (abstracted per the constitution) and cached in PostgreSQL so lookups don't depend on live external API calls. Users can search by name and filter by growing zone or plant type. Authenticated users can save plants to a personal favorites/reference list tied to their account. This feature does not include planting scheduling, garden layout placement, or care reminders — those are separate features."

## Clarifications

### Session 2026-08-01

- Q: How should the local plant catalog get filled and updated from the external source? → A: Hybrid — operator-triggered baseline sync (admin API/CLI; scheduled/cron deferred) keeps a baseline catalog; on-demand fetch is allowed as a secondary path when a name search has no local match
- Q: When an authenticated user adds or removes a favorite while offline, what should happen? → A: Offline queue — change is saved on-device immediately and synced to the account when connectivity returns
- Q: Who may search and browse the plant catalog (not including favorites)? → A: Authenticated only — users must sign in to search, filter, and view plant details
- Q: What should a single catalog plant entry represent for identity, favorites, and de-duplication? → A: Garden variety — one entry per distinct plantable variety (species plus cultivar/variety when available; species-only when no cultivar is known)
- Q: When a signed-in user opens the plant catalog with no name query entered, what should they see? → A: Browseable catalog — show a paged/default list of plants; filters alone can narrow that list without a name query
- Q: (Analysis remediation) Baseline catalog sync mechanism for v1? → A: Operator-triggered only (admin API and/or CLI); scheduled/cron deferred

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search and Browse the Plant Catalog (Priority: P1)

A signed-in gardener opens the plant catalog, searches by common or species name, and opens a plant entry to see growing details needed for planning (zones, sun, water, maturity, spacing).

**Why this priority**: Finding plant information is the core value of this feature; without search and detail views, filters and favorites have nothing useful to attach to.

**Independent Test**: With a populated catalog, a signed-in user can open the catalog without typing a name, see a default plant list, open a result, and see all required plant attributes without using filters or favorites.

**Acceptance Scenarios**:

1. **Given** the catalog contains plants and the user is signed in, **When** they open the catalog with no name query, **Then** they see a paged default list of plants with enough identity information to choose among them (at least common name, species, and cultivar/variety when known).
2. **Given** the catalog contains plants, **When** the user enters a partial common name that matches entries, **Then** matching plants are listed with enough identity information to choose among them (at least common name, species, and cultivar/variety when known).
3. **Given** search or browse results are shown, **When** the user opens a plant, **Then** the detail view shows common name, species, cultivar/variety when known, growing zone range, sun requirements, water needs, days to maturity, and spacing requirements.
4. **Given** the user searches for a name with no matches in the catalog, **When** results return, **Then** the user sees a clear empty state and is not shown unrelated plants as if they matched.
5. **Given** the catalog has been previously populated for local use, **When** the user browses, searches, or opens a plant that is already persisted, **Then** results come from the local catalog without requiring a live call to the external plant data source at lookup time.
6. **Given** a name search has no local matches and the external source is reachable, **When** the secondary on-demand path runs, **Then** any newly found plants are persisted locally and then shown from the local catalog.

---

### User Story 2 - Filter by Growing Zone and Plant Type (Priority: P2)

A signed-in gardener narrows the catalog (alone or combined with a name search) by growing zone and/or plant type so they only see plants relevant to their conditions and intent.

**Why this priority**: Zone and type filters make a large catalog usable for real garden planning; they build on browse/search but are not required for a minimal useful catalog.

**Independent Test**: With a populated catalog spanning multiple zones and types, a signed-in user can open the catalog, apply zone and/or type filters without a name query, and only see matching plants; combining filters with a name query also works.

**Acceptance Scenarios**:

1. **Given** plants of multiple types exist, **When** the user filters by one plant type with no name query, **Then** only plants of that type appear in the browsable list.
2. **Given** plants spanning multiple growing zones exist, **When** the user filters by a growing zone with no name query, **Then** only plants whose zone range includes that zone appear.
3. **Given** the user has entered a name search and selected zone and/or type filters, **When** results are shown, **Then** each result satisfies the name criteria and all active filters.
4. **Given** active filters yield no matches, **When** results return, **Then** the user sees a clear empty state and can clear or change filters to try again.

---

### User Story 3 - Personal Plant Favorites (Priority: P3)

An authenticated gardener saves plants from the catalog to a personal favorites/reference list, reviews that list later, and removes plants they no longer want saved.

**Why this priority**: Favorites add personalization on top of a working catalog; the catalog remains valuable without them.

**Independent Test**: As a signed-in user, save a plant from its detail view, open the favorites list to see it, and remove it; another user must not see those favorites.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing a plant that is not favorited, **When** they save it to favorites, **Then** the plant appears on their personal favorites list.
2. **Given** an authenticated user with saved favorites, **When** they open their favorites list, **Then** they see only plants they saved, with enough information to recognize and reopen each plant.
3. **Given** an authenticated user viewing a favorited plant (or their favorites list), **When** they remove it from favorites, **Then** it no longer appears on their list and the catalog entry itself remains available.
4. **Given** User A has favorites, **When** User B is signed in, **Then** User B does not see User A's favorites.
5. **Given** a visitor who is not authenticated, **When** they attempt to open catalog search, plant detail, or save a favorite, **Then** they are prompted to sign in and no catalog data or favorite is exposed until they authenticate.
6. **Given** an authenticated user is offline, **When** they add or remove a favorite, **Then** the change is reflected on-device immediately and is synced to their account when connectivity returns.

---

### Edge Cases

- Catalog is empty (not yet populated): user sees an empty-catalog message, not a failure that looks like a broken search.
- Default browse with a large catalog: user sees a first page of results and can move through additional pages; the UI does not attempt to dump the entire catalog in one unpaged view.
- External plant source is unavailable: users can still search and browse already-cached catalog data; operator sync and on-demand miss-fill may be deferred without blocking lookups of persisted plants.
- Search finds no local match and on-demand fetch also returns nothing (or fails): user sees the same clear empty state as a pure local miss.
- Search text is very short, whitespace-only, or contains special characters: system handles safely and returns either valid matches or an empty state (no crash or confusing error).
- Plant attribute values are missing from the source for some fields: detail view still opens and clearly indicates unavailable attributes rather than inventing values.
- User favorites a plant that is later removed or deprecated from the catalog: favorites list indicates the entry is unavailable while preserving the user's ability to remove it.
- Rapid repeated favorite/unfavorite actions: final state matches the user's last intentional action; no duplicate favorite rows for the same user and plant.
- Offline favorite changes that sync after reconnect: server state ends consistent with the user's last on-device intent; pending sync status is visible if sync has not completed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to search the plant catalog by common name, species name, and cultivar/variety name when present (partial matches allowed).
- **FR-002**: Authenticated users MUST be able to browse the catalog as a paged default list without entering a name query, browse name-search results, and open an individual plant detail view. (Zone and type filters are specified in FR-005–FR-007.)
- **FR-003**: Each plant detail MUST present: common name, species, cultivar/variety when known, growing zone range, sun requirements, water needs, days to maturity, and spacing requirements.
- **FR-004**: Each catalog plant MUST represent one distinct garden variety (species + cultivar/variety when available; species-only otherwise). Favorites and de-duplication MUST key off that variety identity so the same plant is not listed or favorited as multiple unrelated entries.
- **FR-005**: Authenticated users MUST be able to filter plants by growing zone such that results include only plants whose zone range covers the selected zone.
- **FR-006**: Authenticated users MUST be able to filter plants by plant type (using the catalog's supported type categories: vegetable, herb, flower, fruit, shrub, and tree).
- **FR-007**: Authenticated users MUST be able to combine name search with zone and/or type filters; all active criteria MUST apply together.
- **FR-008**: Catalog lookups for search, filter, and detail MUST be served from the locally persisted catalog so normal use does not depend on a live external plant-data call.
- **FR-009**: The system MUST obtain plant catalog data from an external plant data source in a way that does not lock the product to a single vendor (the source MUST be replaceable without changing how users search and browse).
- **FR-010**: The system MUST persist obtained plant data in the local catalog so subsequent lookups use that persisted data.
- **FR-011**: The system MUST maintain a baseline local catalog via operator-triggered sync from the external source (admin API and/or CLI). Scheduled/cron sync is deferred beyond this feature’s v1 scope.
- **FR-012**: When a user search finds no local match, the system MAY fetch from the external source as a secondary path, persist any new matches into the local catalog, and then return results from local data; normal lookups of already-persisted plants MUST still not require a live external call.
- **FR-013**: Authenticated users MUST be able to add a plant to a personal favorites/reference list tied to their account.
- **FR-014**: Authenticated users MUST be able to view and remove plants from their own favorites list.
- **FR-015**: Favorites MUST be private to the owning user; other users MUST NOT read or modify another user's favorites.
- **FR-016**: Unauthenticated users MUST NOT search, filter, view plant details, or create/modify favorites; attempts MUST require authentication first.
- **FR-017**: When offline, authenticated users MUST be able to add or remove favorites on-device immediately; those changes MUST sync to the user's account when connectivity returns, and the product MUST NOT silently drop the user's intent.
- **FR-018**: The feature MUST NOT include planting scheduling, garden layout placement, or care reminders.

### Key Entities *(include if feature involves data)*

- **Plant**: A catalog entry representing one distinct garden variety—botanical species plus cultivar/variety when known (species-only when no cultivar is known). Attributes include common name, species, optional cultivar/variety, growing zone range, sun requirements, water needs, days to maturity, spacing requirements, and plant type. Identity is stable so the same variety can be reopened and favorited over time; duplicate imports of the same variety MUST resolve to one catalog entry.
- **Plant Catalog**: The locally persisted collection of plants available for search, filter, and detail; sourced from an external provider and kept for offline-capable lookups.
- **Favorite**: A per-user reference linking an authenticated user to one catalog plant (garden variety) they chose to save; owned solely by that user; at most one favorite per user per plant.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Only authenticated users may search, filter, and view plant catalog entries. Only the owning authenticated user may create, view, and delete their favorites. Catalog content is shared reference data among authenticated users (not per-user owned).
- **Sharing rules**: Favorites are not shareable in this feature. Catalog plants are readable by all authenticated users; there is no per-plant ownership model. Unauthenticated access to catalog or favorites is not allowed.
- **Isolation**: One user's favorites MUST never be visible or editable by another user. Catalog data is common among authenticated users; personal lists are isolated.

### Offline / PWA Considerations *(include if feature has client behavior)*

- The web client MUST be an installable offline-capable PWA. After catalog list pages and plant details have been loaded while online, search/browse/detail for those cached entries MUST remain usable when the device cannot reach the API or external provider (client cache / service worker). Offline zone/type filters MUST apply only to already-cached result sets (client-side), or show a clear empty/unavailable state for filter queries that were never loaded while online—they MUST NOT require a live API call to fail silently.
- Search, filter, and plant detail for plants already present in the server local catalog MUST remain usable without connectivity to the external plant data provider (server-side).
- Viewing favorites that were previously loaded on the device MUST work offline.
- Adding or removing favorites while offline MUST succeed on-device immediately and sync when connectivity returns; the product MUST NOT silently drop the user's intent. If sync later fails, the user MUST be able to see that the change is still pending or needs attention.
- Refreshing catalog content from the external provider (operator sync or on-demand miss-fill) MAY require connectivity; lack of connectivity MUST NOT block use of already-persisted or client-cached catalog data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing with a populated catalog, at least 90% of participants can find a named plant and open its detail view in under 1 minute on the first attempt (via search or browse+filter).
- **SC-009**: With a populated catalog and no name query, opening the catalog shows a usable first page of plants; applying a zone or type filter alone returns only matching plants.
- **SC-002**: Given known fixtures, filtering by a specific growing zone returns only plants whose zone range includes that zone (100% correct inclusion/exclusion on the fixture set).
- **SC-003**: Given known fixtures, filtering by plant type returns only plants of that type (100% correct inclusion/exclusion on the fixture set).
- **SC-004**: After catalog data has been persisted locally, users can complete search and detail flows without any live dependency on the external plant data source.
- **SC-005**: An authenticated user can add a plant to favorites, see it on their list, and remove it, with the round trip completing in under 30 seconds in normal interactive use (including confirming on-device success when offline before sync completes).
- **SC-006**: In a two-account check, User B never sees User A's favorites (0 cross-user leaks in verification). Unauthenticated callers cannot access catalog search/detail either.
- **SC-007**: At least 85% of participants agree the plant detail information is clear enough to judge whether a plant fits their garden conditions (sun, water, zone, spacing, maturity).
- **SC-008**: After reconnecting from offline favorite changes, the account favorites list matches the user's last on-device intent within one successful sync cycle (no silently lost add/remove).

## Assumptions

- Glossary: A **garden variety** is one catalog Plant. Field `cultivar` holds the cultivar/variety name when known; otherwise null (species-only entry). UI may label it “Variety.”
- Growing zones follow the common hardiness-zone model familiar to home gardeners (e.g. selectable individual zones such as "7"); a plant's "growing zone range" is inclusive of the zones where it can be grown.
- A catalog plant is a garden variety (species + cultivar when known). Name search matches common name, species, and cultivar text.
- Plant types for v1 are: vegetable, herb, flower, fruit, shrub, and tree. Additional types can be added later without changing the filter behavior contract.
- The application requires authentication for plant catalog search, filter, and detail as well as favorites. Guest-only anonymous browsing is out of scope for this feature.
- Local catalog population uses a hybrid model: operator-triggered sync (admin API/CLI) maintains a baseline catalog; on-demand external fetch runs only as a secondary path when a name search has no local match. Scheduled/cron sync is out of scope for v1. End users are not required to manually import plant files for basic use.
- When the external provider is down, stale local catalog data remains available; on-demand miss-fill is skipped or fails gracefully with the local empty state; perfect real-time freshness is not required for v1 of this feature.
- Duplicate imports of the same garden variety from the external source resolve to a single catalog entry rather than parallel duplicates.
- Favorites are a flat personal list (no folders, tags, or shared favorite lists in this feature). Offline favorite changes queue on-device and sync when connectivity returns.
- Planting calendars, garden layout placement, care reminders, inventory of plants physically in a garden bed, and purchasing/ordering plants are out of scope.
- Catalog results (default browse, search, and filters) are presented as a paged list suitable for a household-scale catalog; exact page size follows product UX defaults at planning time.
