# ADR 0034: Renaming, deleting, and moving beds between areas

## Status

Accepted.

## Context

A property holds the address, zone, frost dates, and climate; its typed
areas (vegetable garden, orchard, bramble patch, greenhouse) hold its beds
and trays (principle VIII, [ADR 0021](0021-area-rules-by-habit.md)). A
household can add a second area of a kind ("Vegetable garden 2"), but until
now could not rename one, delete one, or move a bed between them. Soil tests
per area ([ADR 0033](0033-soil-tests.md)) made areas something a household
looks after, so they need names it chose and a way to tidy them up.

Walkways and other non-planting parts of the plan were deleted through
`DELETE /gardens/:id/areas/:id`, the path typed areas now need.

## Decision

1. **Rename.** `PATCH /gardens/:id/areas/:areaId` with a name, unique within
   the property (409 when taken), at most 120 characters.
2. **Delete only an empty area.** `DELETE /gardens/:id/areas/:areaId` is
   refused (409, "still holds 2 beds: move or delete them first") while the
   area holds beds or trays, so nothing a household planted is lost by
   accident. Its soil tests go with it.
3. **Move a bed.** The bed PATCH takes `areaId`. Every plant in the bed must
   suit the new area, by the same rules as placing it (a hard gate, principle
   VIII): a tomato bed may move to another vegetable garden, not a bramble
   patch, and an orchard bed holds one tree. A greenhouse holds trays, not
   beds. The bed's station follows its new area (`stationFor`, the inverse of
   `areaKindFor`). A move needs a connection: the server's rules decide, and a
   queued change could not tell the member it was refused.
4. **Walkways move to `DELETE /gardens/:id/walkways/:walkwayId`**, so `areas`
   means typed areas only, as in the glossary. A walkway id never matches a
   typed area, so a client still on the old path cannot delete the wrong
   thing; it gets 404.
5. **On the plan**, editors see each area in the sidebar with its name
   (rename), what it holds ("2 beds", "1 tray"), its soil test, and Delete
   once it is empty, after a confirm. The bed inspector has an Area picker
   when the property has more than one area a bed can be in; a refused move
   puts the picker back.

## Consequences

- Areas have names a household chose and can be tidied, without a schema
  change.
- Drawing each area's outline on the plan, and a read-only area view for
  viewers, are the second half of roadmap step 8.
