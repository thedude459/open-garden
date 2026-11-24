# ADR 0043: Writes that span rows commit together

## Status

Accepted.

## Context

Three operations write several rows with separate statements:

- **Deleting a bed** removes its direct-seeded plantings, sends its
  transplants back to waiting (into a greenhouse tray when there is one),
  then deletes the bed.
- **Saving a layout** updates each bed's geometry, each planting's place,
  and each non-planting area.
- **Repeating a sowing** inserts one planting per date in the series.

None ran in a transaction. A failure part-way (a dropped connection, a
restart, a constraint) kept the earlier writes. A database test showed it:
the bed's plantings were gone and the bed was still there. Services depend
on repository interfaces, not on Drizzle, so they could not open a
transaction themselves.

## Decision

1. **A `Transaction<Repos>` port** in `shared-types`:
   `<T>(work: (repos: Repos) => Promise<T>) => Promise<T>`. A service that
   needs an atomic write takes one, with `Repos` listing only the write
   methods that operation uses (`BedDeleteWrites`, `LayoutWrites`, and
   `{ plantings: insert }` for a succession series).
2. **The API implements it with `transactionOn(db, repos)`** from
   `plant-catalog-data`: `db.transaction`, with the same repositories built
   on the transaction. A throw from the work rolls everything back.
   `AppDatabase` is Drizzle's `PgDatabase` base for node-postgres, which a
   transaction also extends, so repositories need no change and no casts.
3. **Writes leave the service's other dependencies.** The repository
   methods an atomic operation writes with are removed from the service's
   own dependency types, so a write outside the transaction does not
   compile.
4. **Tests:** a PGlite spec runs each operation's writes, fails part-way,
   and checks nothing changed. Unit tests pass the fakes straight through.

## Consequences

- A failed bed deletion, layout save, or succession series changes nothing;
  the member can retry.
- A new multi-row write should take a `Transaction` port the same way.
- A transaction holds one connection for its length. Layout save still
  writes row by row inside it; the layout load test (100 placements) keeps
  it inside its 1-second budget.
