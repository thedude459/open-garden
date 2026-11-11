# ADR 0020: The open-garden-data release is the catalog

## Status

Accepted

## Context

ADR 0019 added the dataset as one more pipeline source next to the fixture
and Perenual sources, behind a source order, a daily scheduler, and a
`.sha256` file beside the catalog. With dataset v0.1.0 tagged (50 crops), the
roadmap makes it the default and removes the rest. Four problems had to be
solved first:

- A `.sha256` beside the file catches corruption, not tampering: whoever can
  replace the file can replace its checksum.
- Existing gardens hold plantings of fixture plants (`species|cultivar`
  keys) that the dataset knows under its own ids.
- A new release can widen a crop's spacing or change its type. The layout
  check blocked any save while any spacing problem existed, so one release
  could lock every garden that followed the old values.
- An incompatible data release would only be noticed when a household
  upgraded.

## Decision

1. **One source.** The pipeline imports the dataset only: the release bundled
   in the API image (`libs/plant-provider/catalog/`), or the file
   `PLANT_CATALOG_FILE` names. The Perenual and fixture providers, catalog
   miss-fill on search, the scheduler, and the settings (cadence, run hour,
   source order) are removed. The API imports on every start; an unchanged
   catalog writes nothing, and an upgraded image brings its release. Run
   history stays.
2. **Tamper protection.** The bundled release's SHA-256 is pinned in code
   (`BUNDLED_CATALOG`). Any other file is accepted only when its
   `.sigstore.json` provenance attestation verifies: signed through Sigstore
   for the data repository's release workflow at a `vX.Y.Z` tag, with the
   file's digest as the statement subject. Verification uses
   `@sigstore/verify` and runs offline against the Sigstore trust root
   shipped in `@sigstore/tuf` (a `ponytail:` notes the refresh path).
3. **Mapping in a migration.** Migration 0003 maps old keys to dataset ids
   with a table generated from v0.1.0. Where no dataset row exists yet, the
   old row takes the dataset id and the next import fills it in place, so
   plantings keep the same plant. Where one exists, plantings, calendar
   entries, favorites, and companion pairs move to it. Plants with no match
   stay as deprecated rows that still display.
4. **Saved gardens are never blocked.** The layout check compares against the
   saved layout: a spacing or fit problem it already had is flagged ("Closer
   than recommended") until one of its plantings moves or its bed is resized.
   API and planner share the rule (`evaluateLayout`). The bed check runs only
   when a planting moves to another bed or tray; a planting its bed would no
   longer accept is flagged on the plan.
5. **Daily compatibility check.** A scheduled workflow downloads the latest
   data release and runs the app's importer on it, attestation included.
6. **Names.** A crop and its varieties share a common name, so the UI names a
   variety "Tomato (Cherry)" (`plantName` in shared types) wherever people
   pick or see a plant.

## Consequences

+ A fresh install works offline with real, sourced plant data.
+ A replaced or altered catalog file is refused; a newer genuine release can
  be used before the app ships it.
+ Upgrading the catalog cannot lock or empty a garden.
- New dependencies: `@sigstore/verify`, `@sigstore/bundle`, `@sigstore/tuf`,
  `@sigstore/protobuf-specs` (Apache-2.0).
- Moving the bundled release is a code change: new files, a new pinned hash,
  and e2e specs updated if crops they use changed.
- A Perenual install loses that source; its plants become deprecated unless
  their keys map to dataset ids.
- The "Catalog version" page (available version, import action, diff) is
  still to come; until then a newer release is set with `PLANT_CATALOG_FILE`.
