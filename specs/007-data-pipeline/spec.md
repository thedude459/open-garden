# Feature Specification: Catalog Data Pipeline

**Feature Branch**: `007-data-pipeline`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Instead of having a sync option for getting data from APIs for the app, I want to have a datapipeline that will get data from all different sources, normalize it, and then save it so it can be used by the database."

## Clarifications

### Session 2026-08-18

- Q: How complete should each pipeline run be when it pulls from a source? → A: Full load — each successful source contributes its complete available catalog (capped only by what the source itself can provide)
- Q: If a pipeline run is already in progress, what should happen when another run is started? → A: Reject — the in-progress run continues; the second start is refused with an already-running outcome
- Q: Where should operators start runs, inspect results, and configure the schedule? → A: In-product operator/admin area — operators start runs, inspect results, and set the recurring schedule there; gardeners never see it
- Q: If a catalog variety was marked unavailable/deprecated because it disappeared from sources, and a later successful full load finds it again, what should happen? → A: Reactivate — the same variety becomes available again and its attributes update from the new load
- Q: For v1, how many real plant data sources must the pipeline actually ingest in production? → A: Multi-source capable in v1, but production may run fixture plus a single live plant source; additional live sources can be added later

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Populate the Catalog Without In-App API Sync (Priority: P1)

An operator runs the data pipeline (on a schedule or on demand). The pipeline pulls each configured source’s complete available plant catalog, normalizes it into the product’s shared plant catalog shape, and saves the result so the application catalog can serve gardeners from persisted data. Gardeners search, browse, and open plant details as they do today, without a “sync from APIs” action in the product.

**Why this priority**: Replacing in-app/API sync with a dedicated ingest path is the core of this feature. Until the pipeline can load a usable catalog into the application store, nothing else in this feature delivers value.

**Independent Test**: With at least one source available, start a pipeline run, wait until it finishes successfully, then as a signed-in gardener search or browse the catalog and open a plant detail that came from that run — without any gardener-facing sync action and without the app calling external plant sources at lookup time.

**Acceptance Scenarios**:

1. **Given** at least one plant data source is configured and reachable, **When** an operator starts a pipeline run, **Then** the pipeline fetches that source’s complete available catalog (not a bounded sample), normalizes it, and persists catalog entries the application can serve.
2. **Given** a pipeline run has completed successfully, **When** a signed-in gardener searches, browses, or opens plant detail for a persisted plant, **Then** results come from the application catalog and do not require a live call to any external plant source.
3. **Given** a gardener is using the catalog, **When** they look for a way to sync or refresh catalog data from external APIs, **Then** no such gardener-facing sync option is offered.
4. **Given** the catalog was previously empty, **When** the first successful pipeline run finishes, **Then** gardeners see a populated catalog rather than an empty-catalog state for plants that were loaded.
5. **Given** the application is serving catalog lookups, **When** a name search has no local match, **Then** the app does not fetch from an external plant source as a secondary path; the gardener sees the same empty state as a local miss.

---

### User Story 2 - Combine Multiple Sources into One Catalog (Priority: P2)

The pipeline reads from every configured plant data source in a run, maps each source’s fields into the same catalog attributes gardeners already see (identity, growing details, type), and merges records that represent the same garden variety so the catalog does not list the same plant twice.

**Why this priority**: “All different sources” only pays off if gardeners get one coherent catalog. Merge and normalization can follow a working single-source load.

**Independent Test**: Configure two sources (fixture sources are sufficient) that overlap on at least one garden variety and differ on at least one other variety; run the pipeline; confirm overlapping varieties appear once with complete required attributes, and unique varieties from each source appear as their own entries.

**Acceptance Scenarios**:

1. **Given** multiple plant data sources are configured, **When** a pipeline run completes successfully, **Then** catalog entries originating from every successful source are available to gardeners in one catalog.
2. **Given** two sources describe the same garden variety (same species and cultivar/variety when known), **When** both are ingested, **Then** gardeners see a single catalog entry for that variety, not parallel duplicates.
3. **Given** sources use different field names, units, or category labels for the same meaning, **When** records are saved, **Then** gardeners see attributes in the product’s catalog terms (common name, species, cultivar/variety when known, zone range, sun, water, days to maturity, spacing, plant type) rather than raw source labels — mapping happens in each source adapter before merge.
4. **Given** a source omits an optional attribute that another source provides for the same variety, **When** records are merged, **Then** the catalog entry keeps the available value rather than dropping it without cause.
5. **Given** two sources disagree on a required attribute for the same variety, **When** they are merged, **Then** the pipeline applies a documented, repeatable precedence rule and records which source won so an operator can audit the result.
6. **Given** a variety was marked unavailable after disappearing from sources, **When** a later successful full load includes that same variety, **Then** gardeners see the original catalog entry as available again with updated attributes, not a second duplicate plant.

---

### User Story 3 - Operators Monitor Runs and Recover from Failures (Priority: P3)

An operator can start a pipeline run, see whether it is running, succeeded, or failed, inspect which sources contributed, and configure the recurring schedule from the product’s operator/admin area (not gardener screens). They can re-run after a failure without wiping catalog data that was already loaded successfully.

**Why this priority**: Ingest that cannot be observed or retried is not operable. Monitoring is required for a trustworthy pipeline but is not needed to prove a first successful load.

**Independent Test**: Start a run against a healthy source and confirm success details; start a run where one source fails; confirm the failure is visible, previously good catalog data remains, and a later successful re-run updates the catalog.

**Acceptance Scenarios**:

1. **Given** an operator with permission to operate the pipeline, **When** they open the product’s operator/admin area, **Then** they can start a run, see that a run is in progress, and later see whether it succeeded or failed — without using gardener catalog screens.
2. **Given** a run finished, **When** the operator inspects it, **Then** they can see when it ran, how many catalog entries were written or updated, which sources were attempted, and which sources succeeded or failed.
3. **Given** one configured source is unreachable or returns unusable data and another source succeeds, **When** the run finishes, **Then** data from the successful source is saved, the failed source is reported, and the overall run is marked as incomplete rather than silently succeeding.
4. **Given** a source fails entirely, **When** the run ends, **Then** catalog entries previously loaded from successful runs remain available to gardeners (the pipeline does not empty the catalog because a refresh failed).
5. **Given** a previous run failed or was incomplete, **When** the operator starts a new run after the problem is fixed, **Then** the new run can complete and update the catalog without requiring a manual catalog wipe.
6. **Given** a gardener (non-operator) is signed in, **When** they use the product, **Then** they cannot start pipeline runs, view raw source payloads, or see operator-only run diagnostics.
7. **Given** a pipeline run is already in progress, **When** an operator or the schedule tries to start another run, **Then** the in-progress run continues unchanged and the second start is refused with a clear already-running outcome (it is not queued, it does not wait, and it does not cancel the current run).
8. **Given** an operator in the operator/admin area, **When** they set or change the recurring schedule, **Then** later runs start on that cadence without gardener involvement, and gardeners still have no schedule or sync control.

---

### Edge Cases

- No sources are configured: a run does not pretend to succeed; the operator sees a clear configuration error and the catalog is left unchanged.
- A source is reachable but returns an empty set: the run records that outcome; existing catalog data is not deleted solely because a source returned nothing this time.
- A source returns malformed or incomplete records: invalid records are skipped and counted; valid records from that source and others are still saved; the run reports how many records were rejected.
- A source is rate-limited or interrupted mid-run: the run is marked failed or incomplete and **does not publish** a partial catalog. Gardeners keep the last successfully published catalog (no half-normalized entries). The operator can re-run.
- Very large source catalogs: a full load still completes for a household-scale product catalog (thousands of varieties) without blocking gardener lookups. While a run is in progress, operators can see status `running` (counts may stay at zero until publish). A source that cannot finish providing its complete set is treated as interrupted/incomplete, not as a successful partial sample. Counts and per-source results are complete when the run reaches a terminal status.
- Duplicate or near-duplicate names that are not the same garden variety (different species or cultivar): they remain separate catalog entries.
- A previously loaded variety disappears from all sources: the catalog does not silently erase gardener-facing history; the entry is marked unavailable/deprecated rather than hard-deleted so favorites and plantings that reference it remain understandable.
- A previously deprecated variety reappears in a later successful full load: the same catalog entry becomes available again and its attributes are updated from that load; a second catalog plant is not created.
- Concurrent operator-triggered and scheduled runs: only one run writes at a time. If a run is already in progress, a second start is rejected with a clear already-running outcome; it is not queued and does not cancel or overlap the current run.
- Source credentials are missing or invalid: the run fails that source with an operator-visible error and does not expose secrets to gardeners or in gardener-facing errors.
- Pipeline runs while gardeners are browsing: lookups continue against the last successfully persisted catalog; gardeners are not blocked and do not see a half-updated catalog mid-write.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST ingest plant catalog data through a dedicated data pipeline that fetches from configured external sources, normalizes records, and persists them into the application catalog used by gardeners.
- **FR-002**: The gardener-facing product MUST NOT offer a sync-from-APIs action to load or refresh catalog data from external sources.
- **FR-003**: Catalog search, browse, filter, and detail MUST be served from persisted catalog data and MUST NOT call external plant data sources at lookup time (including when a name search has no local match).
- **FR-004**: The pipeline MUST be able to read from all plant data sources configured for a run in one ingest cycle, not only a single source.
- **FR-020**: v1 MUST prove multi-source ingest and merge (at least two sources in verification; fixture sources count). Local and CI MAY run fixture-only. When a live plant source is configured (credentials present), an operator MAY enable it alongside the fixture source. v1 MUST NOT require a live source for every environment and MUST NOT require a second live plant source. Adding further live plant sources later MUST NOT change how gardeners search and browse.
- **FR-018**: For each source that succeeds in a run, the pipeline MUST ingest that source’s complete available catalog. A run MUST NOT treat a bounded sample or first-N page as a successful full load. Incremental/delta-only ingest is out of scope for v1.
- **FR-005**: The pipeline MUST persist records in the product’s catalog plant shape: one garden variety per entry (species plus cultivar/variety when available; species-only otherwise), with common name, species, optional cultivar/variety, growing zone range, sun requirements, water needs, days to maturity, spacing, and plant type. Vendor-specific field names, units, and category labels MUST be mapped into that shape by each source adapter **before** merge; the pipeline MUST NOT invent values.
- **FR-006**: The pipeline MUST de-duplicate records that represent the same garden variety across sources so gardeners see one catalog entry per variety.
- **FR-007**: When sources conflict on the same variety’s attributes, the pipeline MUST apply a documented, deterministic precedence rule and retain enough origin information for an operator to see which source supplied the winning values.
- **FR-008**: Records that cannot be normalized to a valid garden variety (missing identity, unusable required fields) MUST be rejected without blocking persistence of valid records from the same run.
- **FR-009**: Operators MUST be able to start a pipeline run on demand and MUST be able to configure the pipeline to run on a recurring schedule, both from the product’s operator/admin area, without gardener involvement.
- **FR-010**: Operators MUST be able to inspect pipeline runs from the product’s operator/admin area: status (running, succeeded, failed, incomplete), start and finish time, per-source success or failure, counts of records accepted/rejected/updated, and a non-secret error summary when a source fails.
- **FR-011**: A failed or incomplete run MUST NOT remove or empty catalog data that was successfully loaded by prior runs.
- **FR-012**: Only operators MAY start runs, change source configuration or schedule, or view run diagnostics. Diagnostics are per-source results, counts, safe error summaries, and a merge audit of which source won each field — **not** raw vendor payloads. Those capabilities MUST live in the product’s operator/admin area and MUST NOT appear on gardener screens. Gardeners MUST NOT see pipeline diagnostics, source configuration, or a catalog-sync control. Catalog freshness is the last successful load; a gardener-visible “last updated” indicator is not required in v1.
- **FR-013**: External source access MUST remain replaceable: adding, removing, or swapping a plant data source MUST NOT change how gardeners search and browse the catalog.
- **FR-014**: When a variety that was previously loaded is no longer present from any source after a successful full ingest, the pipeline MUST mark that catalog entry unavailable/deprecated rather than hard-deleting it. If a later successful full load finds the same variety again, the pipeline MUST reactivate that same catalog entry (not create a duplicate) and MUST update its attributes from the new load.
- **FR-015**: The pipeline MUST prevent overlapping writes from two runs at the same time. If a run is already in progress, a subsequent start (operator or scheduled) MUST be rejected with an already-running outcome; it MUST NOT queue, block-and-start-later, or cancel the in-progress run.
- **FR-016**: This feature MUST NOT change gardener ownership, sharing, or offline behavior of gardens, plantings, favorites, reminders, or other user-owned data. User-owned “sync” of personal changes is out of scope.
- **FR-017**: Non-plant source types (weather, imagery, market prices, and similar) MUST NOT be required for v1 of this pipeline.

### Key Entities *(include if feature involves data)*

- **Data Source**: A configured origin of plant catalog data (for example a live plant information provider or a deterministic fixture/sample source). Each source has an identity, operator-managed credentials or connection settings, and can succeed or fail independently in a run.
- **Source Record**: One plant-like item as received from a source before it is mapped into product terms. Not shown to gardeners.
- **Catalog Plant**: The gardener-visible catalog entry for one garden variety after normalization and merge. Same meaning as today’s catalog plant (identity plus growing attributes).
- **Pipeline Run**: One execution of fetch → normalize → save. Has status, timing, per-source results, and counts. Visible to operators only.
- **Merge Decision**: The recorded outcome of combining records for the same variety (which sources contributed, which source won a conflicting field). Used for operator audit, not gardener UI.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Operators (the product’s existing admin/operator role) may configure sources, set the recurring schedule, start runs, and inspect run diagnostics from the operator/admin area. Authenticated gardeners may read the resulting shared catalog as they do today and MUST NOT access that operator area. Unauthenticated users still MUST NOT access the catalog (existing catalog access rules unchanged).
- **Sharing rules**: Persisted catalog plants remain shared reference data among authenticated gardeners. Pipeline configuration, credentials, and run diagnostics are not shareable with gardeners and are not garden-scoped. Raw vendor payloads are not stored; merge audit is `fieldWinners` and counts only.
- **Isolation**: One gardener’s favorites, gardens, and other personal data MUST remain untouched by ingest. Operators MUST NOT need access to household gardens to run the pipeline. Source secrets MUST never appear in gardener-facing screens or messages.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Gardeners MUST continue to search, browse, and open already loaded/cached catalog entries while offline. Catalog freshness depends on the last successful pipeline load, not on device connectivity to external plant sources.
- Because the app no longer fetches external plant sources on miss, being online MUST NOT produce extra catalog hits that being offline would miss; online and offline lookup behavior match for persisted data.
- Starting or monitoring pipeline runs MAY require connectivity and is done in the operator/admin area, not as a gardener offline flow.
- User-owned offline queues (favorites, plantings, and similar) are unchanged by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one successful pipeline run against a known fixture source of at least 50 plants, a signed-in gardener can find a named plant and open its detail in under 1 minute with no gardener-facing sync step and no live external-source dependency at lookup time.
- **SC-009**: Given a fixture source whose complete set is N valid plants (N ≥ 50), a successful run persists all N plants (100% of that source’s complete available catalog), not a bounded prefix.
- **SC-002**: Given a **controlled pair** of source datasets that overlap on 10 varieties and each contribute 10 unique varieties, merging those two datasets yields exactly 30 catalog varieties (10 merged + 20 unique) — 0 duplicate variety entries. This pair is independent of the full household fixture catalog size (≥50 plants used for SC-009).
- **SC-003**: At least 95% of valid fixture source records in a test set appear as catalog entries with all required gardener-facing attributes populated or explicitly marked unavailable (no invented values).
- **SC-004**: When a primary source is taken down after a successful load, 100% of previously loaded plants remain searchable from the catalog; gardeners do not see a catalog-wide failure.
- **SC-005**: In operator verification, 100% of failed runs (bad credentials, unreachable source, empty configuration) show a non-secret failure reason and do not empty the catalog.
- **SC-006**: An operator can start a run and determine within 2 minutes whether it is running, succeeded, or failed (for a fixture-scale catalog).
- **SC-007**: In a two-account check, a gardener cannot start a pipeline run or view operator run diagnostics (0 permission leaks).
- **SC-010**: While a run is in progress, 100% of additional start attempts (operator or scheduled) are rejected as already-running; exactly one run writes, and the original run still completes.
- **SC-011**: After a variety is marked unavailable because it was absent from a successful full load, a later successful full load that includes it again results in exactly one catalog entry for that variety, shown as available, with attributes from the new load (0 leftover deprecated duplicates).
- **SC-008**: At least 90% of operators in a walkthrough can explain, after one run, which sources were used and that gardeners no longer sync the catalog themselves.

## Assumptions

- **v1 domain is the plant catalog.** The current “sync from APIs” path is catalog ingest. The pipeline replaces that path (operator baseline sync and on-demand miss-fill). Other product areas keep their existing behavior.
- **“All different sources” means all configured plant data sources.** v1 is multi-source capable: a run ingests every source in the operator `sourceOrder`. Seeded default order is `fixture` only (last-in-order wins when multiple ids are enabled). When a live source is configured, the operator MAY append it after `fixture` so the live source wins conflicts and fixture fills blanks. Local/CI MAY stay fixture-only. Weather, satellite imagery, and other non-plant feeds are out of scope for v1. Two live vendors are not a v1 gate.
- **Adapter mapping:** Each plant source adapter maps vendor field names, units, and category labels into the shared catalog plant shape before the pipeline merges records. The pipeline does not convert vendor units itself.
- **Normalization target is today’s catalog plant / garden variety**, not a new gardener-facing data model. Attribute names and meaning stay aligned with the existing plant catalog feature.
- **Merge identity** is the same garden-variety rule already used by the catalog (species + cultivar/variety when known). Precedence when sources conflict: last successful source in the configured `sourceOrder` wins per field; earlier sources fill blanks. Seeded `sourceOrder` is `['fixture']`. Recommended operator order when a live source is enabled: `['fixture', '<live-source-id>']`.
- **Scheduling is in scope.** Unlike the earlier catalog feature, recurring pipeline runs are allowed in v1 so the catalog can stay current without someone using a sync option in the app. Default cadence is daily unless the operator chooses otherwise; exact clock time is an operations choice.
- **On-demand miss-fill is removed.** If a gardener searches for a plant not yet in the catalog, they see an empty result until a later pipeline run loads it. This is an intentional trade for keeping the app independent of live source APIs.
- **Existing in-product catalog sync from external sources is retired.** Operators start runs, inspect results, and set the recurring schedule in the product’s operator/admin area instead. Gardeners never see those controls. A separate operations-only console is out of scope for v1.
- **Household-scale catalog** (thousands of varieties, not millions) is the performance envelope. Each successful source is fully loaded in a run; v1 does not cap ingest at a few hundred records the way the retired operator sync did.
- When a source returns nothing, the pipeline does not treat that as “delete the catalog.” Deprecation happens only when a variety is known to have been loaded before and is absent from a successful full ingest of the sources that previously supplied it, following FR-014. A later successful full load that includes the variety again reactivates the same entry.
- User-owned data (accounts, gardens, plantings, favorites, reminders, layouts) is never ingested by this pipeline and is never overwritten by it.
- Catalog access control for gardeners is unchanged: authenticated read of shared reference data; unauthenticated access denied.
