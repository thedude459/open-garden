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
