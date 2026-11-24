# ADR 0042: Fruit gardens

## Status

Accepted. Changes [ADR 0021](0021-area-rules-by-habit.md): orchards and
bramble patches merge into one area type.

## Context

ADR 0021 gave each area type a list of the plants it accepts:

- an orchard took trees and herbaceous underplanting;
- a bramble patch took canes and, "until they have an area of their own",
  fruit bushes;
- a vegetable garden took herbaceous plants.

Dataset v0.3.1 adds fruit that fits none of these cleanly:

- **Woody vines.** Grape and hardy kiwi import as `fruit` because only trees,
  shrubs, and canes were typed by habit. A vegetable bed took them, and
  their plantings defaulted to annual, so closing a season would have
  cleared a grapevine.
- **More bushes.** Currant, gooseberry, elderberry, haskap, and aronia
  joined blueberry in a "bramble patch", which names cane fruit only.

Households do not split woody fruit by habit. A home fruit planting is one
area: a few trees, a row of raspberries, blueberry bushes, a grape on a
trellis, with herbs or flowers underneath. The real line is between that and
the vegetable garden, which is dug and replanted each year. Herbaceous
perennials stay on the vegetable side: asparagus, rhubarb, and strawberries
grow in a vegetable garden as watermelon does.

## Decision

1. **Two growing area types, plus the greenhouse.** `AREA_KINDS` is
   `vegetable`, `fruit`, `greenhouse`.

   | Area | Accepts |
   |---|---|
   | Vegetable garden | vegetable, herb, flower, fruit (all herbaceous) |
   | Fruit garden | tree, cane, shrub, vine, plus herbaceous underplanting |
   | Greenhouse (trays) | vegetable, herb, flower, fruit |

2. **`vine` is a plant type** for a woody perennial vine (grape, hardy
   kiwi). The importer sets it for a crop with habit `vine` and life cycle
   `perennial`. An annual vine (squash, melon, pole bean) keeps its use, so
   it still goes in a vegetable garden. A herbaceous perennial vine (hops)
   would be the one case this misreads; the dataset has none, and when it
   does the crop needs a `woody` flag rather than a guess here.
3. **Bed shapes stay.** A bed in a fruit garden keeps its station: `tree`
   (one tree, with underplanting) or `berry` (a row of canes, bushes, or
   vines; any number of plants). "Add tree" and "Add fruit row" on the
   Overview add one of each. A bed created in a fruit garden without a
   station is a tree bed; a bed moved into one keeps its station. The
   one-tree rule now follows the bed's station, not the area type.
4. **Herbaceous perennials outlive a season.** `plants.perennial` records
   the crop's life cycle from the catalog. A new planting of a perennial
   (asparagus, rhubarb, strawberry) defaults to the `perennial` life, so a
   season close keeps it and rotation advice skips it, as for trees and
   canes. A household can still pick annual (strawberries grown as
   annuals).
5. **Migration 0021** adds the column (the catalog sync fills it on the
   next start) and retypes every `orchard` and `bramble` area to `fruit`.
   Areas keep their names ("Orchard", "Bramble patch") and their beds;
   stations are unchanged, so nothing moves on the plan.

## Consequences

+ Later (migration 0022): every bed has an area, and the area's kind, sent
  with each bed as `areaKind`, decides what it takes. The station only says
  whether a bed is a tree bed or a row, and picks the area when a bed is
  created.

+ A grape, kiwi, currant, or blueberry has a home, and a vegetable bed no
  longer takes a grapevine. One already in a vegetable bed is flagged on the
  plan, not removed (ADR 0020).
+ A household with an orchard and a bramble patch keeps both, now as two
  fruit gardens. A new property needs only one.
+ Adding woody fruit is a data change; no new area type per habit.
- A fruit row takes a tree. That is real (an espalier or a hedgerow), and
  spacing still applies, but nothing stops a row of standard trees.
- An existing planting of a herbaceous perennial keeps the life it was given
  (most are annual). The household changes it in the planting's editor.
