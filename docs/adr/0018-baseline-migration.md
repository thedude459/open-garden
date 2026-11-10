# ADR 0018: Squash migrations into one baseline

## Status

Accepted

## Context

Migrations `0001`–`0012` grew during early development. Several are data fixes
(0012 deleted legacy orchard beds) or undo earlier ones, and every file had to
stay re-runnable because, before migration tracking, host mode ran all of them
on every boot. Phase 1 replaces the plant tables with crops and varieties, and
the roadmap asked for one clean starting point before that change.

`v0.1.0` installs already record all twelve migrations in
`drizzle.__drizzle_migrations`. Drizzle's migrator (0.45) reads the newest
`created_at` recorded there and runs only journal entries with a later
`when`. It does not compare hashes or names.

## Decision

1. Replace `0001`–`0012` with `0000_baseline.sql`: a `pg_dump --schema-only`
   of a database built by those twelve files, with session settings and
   comments removed. One CHECK keeps 0009's original wording so the stored
   definition matches `v0.1.0` exactly.
2. Give the baseline the journal timestamp of 0012 (`1720000000012`,
   `BASELINE_MILLIS`). A new database runs it; a `v0.1.0` database has that
   timestamp recorded already, so it skips the baseline with no marking step.
   Later migrations get real timestamps and run on both.
3. `runMigrations` refuses, with a clear message, the two kinds of database
   the baseline cannot start from, both from builds before `v0.1.0`: tables
   with no migration records (the old run-every-file loop), and records that
   stop before 0012. They upgrade by running `v0.1.0` once first, or start
   empty.
4. Commit Drizzle's snapshot of `schema.ts` as `meta/0000_snapshot.json`, so
   `npm run migrate:generate` produces only the next change.
5. From now on, a migration shipped in a release is never edited. Changes are
   new files.

## Consequences

+ A fresh install runs one file. Phase 1 starts from a schema that matches
  `schema.ts`, and `migrate:generate` works.
+ Verified: a database built by `v0.1.0`'s own migrations, then upgraded by
  this code, keeps its data and has a schema identical to a fresh install's
  (`pg_dump` diff). `apps/api-e2e/src/migrations-db.spec.ts` covers fresh,
  `v0.1.0`, a later migration, and both refusals.
- `schema.ts` does not declare CHECK constraints, so `migrate:generate` does
  not see them; add CHECKs to generated migrations by hand.
- Pre-`v0.1.0` development databases cannot upgrade directly.
- The squash relies on Drizzle comparing timestamps. A Drizzle upgrade that
  changes how applied migrations are detected must be checked against this
  (the `v0.1.0` test above fails if it breaks).
