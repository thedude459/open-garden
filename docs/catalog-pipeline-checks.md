# Catalog import checks

The plant catalog is one source: the open-garden-data release bundled in
`libs/plant-provider/catalog/`, or the file `PLANT_CATALOG_FILE` names. See
[ADR 0019](adr/0019-dataset-catalog-import.md) and
[ADR 0020](adr/0020-dataset-as-the-catalog.md).

## Local stack

```bash
docker compose up -d postgres
npm run api:sync-plants  # migrate, seed, import the bundled release
npm run api:serve        # terminal 1
npm run web:serve        # terminal 2
```

## What to check by hand

1. As a gardener, open the catalog: dataset crops and their varieties
   ("Tomato", "Tomato (Cherry)"). There is no sync control.
2. As a gardener, `POST /api/admin/pipeline/runs` is 403 `Admin role required`.
3. As admin, start a run on `/admin/pipeline`. The run shows one source,
   `dataset`. A second run with nothing changed succeeds with the note
   "Catalog unchanged since the last run; nothing written".
4. Point `PLANT_CATALOG_FILE` at a copy of the release with one byte changed:
   the run fails with "Catalog attestation does not verify" and the catalog
   is unchanged.

Automated coverage: `libs/plant-provider` (pinning, attestation, schema),
`libs/catalog-pipeline` (merge, unchanged runs, deprecation), the
`pipeline-http` live suite, and the daily
[Dataset compatibility](../.github/workflows/dataset-compat.yml) workflow.

## Notes

- Run history keeps the latest 50 runs and anything from the last 90 days;
  older runs, with their sources and merge decisions, are deleted on publish.
- The catalog file is read on every run, so a replaced file is picked up
  without restarting the API.
