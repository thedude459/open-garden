# ADR 0030: Companion pairs from the dataset, ranked by zone

## Status

Accepted. Changes principle VIII in `AGENTS.md`, which kept companion pairs as
household data until a real source existed.

## Context

open-garden-data v0.2.2 publishes 31 companion pairs between crops, drawn
only from research trials and extension guidance. Each pair says what it
does (`benefits`), how well it is known (`evidence`), where it was shown
(`shownIn`, with USDA hardiness zones), and what it rests on (`reference`).
Until now companion pairs were entered by hand per property
(`companion_pairs`, keyed by plant) and shown as planner notes.

Pairs name crops, not varieties, and pests differ by region: a trial in Iowa
says less about the Central Valley than one in California.

## Decision

1. **Crop ids, not a crops table.** Each `plants` row gets `crop_id`, the
   dataset crop it belongs to; a variety carries its crop's id, so a cherry
   tomato has tomato's pairs. The roadmap expected a `crops` table for this;
   one column is enough until a feature needs crop rows of their own.
2. **`catalog_companions`, replaced by the import.** The dataset provider
   exposes `companions()`; the catalog import collects them and replaces the
   table in the transaction that writes plants. An unchanged run writes no
   plants and leaves the pairs. The unchanged-catalog hash covers the pairs,
   so a release that changes only pairs is still written.
3. **Household pairs stay, and win.** `companion_pairs` is unchanged. The
   planner's notes show catalog pairs between plants planted in the property
   beside household pairs; when the household has any pair for the same two
   plants, it replaces the catalog's.
4. **Ranked by zone, never filtered.** The plant page lists a crop's pairs,
   "Grows well with" and "Keep apart from", each with its evidence, where it
   was shown, and its reference. Pairs shown in or nearest the zones of the
   member's properties come first (zone distance, then evidence, then name);
   pairs shown only in a greenhouse come after those with zones. Nothing is
   hidden, since most pairs were tested in only one or two places.
5. **Advice only.** No pair blocks a save; spacing and area rules remain the
   gates (principle VIII).

## Consequences

- A catalog import now writes companion pairs; installs pick them up on the
  next sync after upgrading (migration 0013).
- The plant page ranks by the member's properties, not one chosen property;
  a member with properties in zones 4 and 8 sees pairs from either first.
- When the dataset gains pests (v0.3), a pair's benefits can name the pest,
  and IPM advice can link to the pairs that act on it.
