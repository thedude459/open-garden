# ADR 0019: Import the open-garden-data catalog through the provider port

## Status

Accepted

## Context

Phase 1 replaces the fixture and Perenual plant sources with releases of
[open-garden-data](https://github.com/thedude459/open-garden-data): a CC0
file, `open-garden-catalog-<version>.json`, with a SHA-256 and a provenance
attestation. The app already has a catalog pipeline: registered
`PlantDataProvider` sources, a merge, an upsert into `plants` by
`variety_key`, deprecation of what disappeared, and run history on the admin
Pipeline page.

The dataset differs from the existing sources in four ways:

- Units are metric (cm); `plants` stores inches.
- A crop is what gardeners grow as one kind, so two crops may share a species
  (bush and pole beans). The merge keyed records by species and cultivar,
  which would collapse them.
- Dataset schema v1 has no hardiness zones; `plants.zone_min` and `zone_max`
  are required and drive catalog filters and calendar zone warnings.
- The release is a file from outside the app.

## Decision

1. **A `DatasetReleaseProvider` behind the existing port** (principle III),
   not a separate importer. It reuses the merge, upsert, deprecation, and run
   history. It is registered when `PLANT_CATALOG_FILE` is set; operators add
   `dataset` to the pipeline's source order.
2. **Treat the file as untrusted input.** It is read only when the `.sha256`
   beside it matches, then validated with zod. Fields the app does not use are
   ignored, so newer minor releases import. A bad file fails that pipeline run
   (recorded on the run, nothing imported); it does not stop the API.
3. **Dataset ids are the catalog key.** `ProviderPlant` gains an optional
   `varietyKey`; the dataset sets `dataset:<crop id>` and
   `dataset:<variety id>`. Other sources keep species and cultivar.
4. **One catalog plant per crop and one per variety.** A variety row is the
   crop with the variety's name as `cultivar` and its own days to maturity and
   spacing. The UI shows it as "Tomato (Cherry)".
5. **Mapping.** Spacing and other lengths convert cm → inches, rounded. The
   earliest days to maturity is used. Sun and water map to the existing
   strings. Care intervals come from two classes: water (low 14, moderate 7,
   high 3 days between watering) and feeding (light 42, moderate 28, heavy
   14 days between fertilizing). The dataset gains a required `feeding`
   field (light, moderate, or heavy); the importer accepts a release without
   it and leaves fertilizing unset. Plant type comes from use and
   habit (fruit or nut trees → `tree`, shrubs → `shrub`, other fruit →
   `fruit`).
6. **Zones.** A crop grown for one season (annual or biennial) takes zones
   1–13: it does not need to survive winter. Perennials need
   `hardinessZones` in the dataset; without it the merge rejects the record
   and counts it on the run. The dataset schema gains optional
   `hardinessZones`, required for perennials by its validator.
7. **No `crops` table yet.** The roadmap planned one, with `plants` becoming
   varieties. Nothing reads crop-level rows today: catalog, calendar, layout,
   and reminders all read `plants`. Crop-level fields (family, habit, use)
   are added to `plants` when typed areas and rotation need them, and a
   `crops` table when a feature needs crop rows of its own (companion pairs,
   dataset v0.2), per principle IV.

## Consequences

+ No new pipeline: the admin Pipeline page shows dataset runs, rejections,
  and merge decisions as it does for other sources.
+ A tampered or truncated download is refused before any row changes.
- Dataset plants do not merge with fixture plants of the same species and
  cultivar. Switching an install from the fixture to the dataset needs a
  mapping for existing plantings; that belongs with making the dataset the
  default (when v0.1 has its 50 crops), not here.
- The care intervals are a heuristic (`ponytail:` in the provider). If they
  prove too coarse, the dataset gains per-crop intervals.
- Until a release is bundled in the API image, operators mount the file
  themselves.
