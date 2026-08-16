# ADR 0003: Plant data provider port

## Status
Accepted

## Context
Constitution forbids direct vendor API calls from features; providers must be swappable.

## Decision
Define `PlantDataProvider` in `libs/plant-provider` with `FixturePlantProvider` and `PerenualPlantProvider` adapters. Catalog services depend only on the port.

## Consequences
+ Vendor swap without rewriting domain/UI
+ Deterministic tests via fixture adapter
- Mapping/normalization lives in sync layer

## Amendment (2026-08-16, planting calendar)

`ProviderPlant` MAY include optional frost-relative growing guidance (signed
weeks + last/first frost anchor per indoor/sow/transplant window). Adapters
persist only what the source provides; missing fields stay null. Calendar and
catalog features MUST NOT call a vendor HTTP API — they keep depending on this
port. See ADR 0005 for how those fields become date ranges.
