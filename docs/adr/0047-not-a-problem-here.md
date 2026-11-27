# ADR 0047: Pests that are not a problem here

## Status

Accepted. Roadmap step 13d, first part. Builds on
[ADR 0046](0046-weekly-scout-task.md) (a weekly Scout task per bed).

## Context

A Scout task names every pest of a bed's crops that is known in the
property's country. A household that has never seen one of them, or that
knows it does not reach its valley, keeps being asked to look for it. The
dataset cannot know that; the household does.

## Decision

1. **Per property, per pest.** A household marks a pest "not a problem here"
   for one property (`garden_ignored_pests`: property and pest id). That
   property's Scout tasks leave the pest out, in every bed. Other properties
   and the plant pages are unchanged: plant pages are the member's across all
   their properties, and the pest is still a pest.
2. **Who:** owners and collaborators, as for completing a task. Viewers see
   the list but cannot change it.
3. **Where:** each pest on a Scout task on the property's Tasks page has a
   "Not a problem here" button. Pests marked so are listed at the foot of
   that page, each with "Show again". The reminder list carries them
   (`ignoredPests`) so the page needs no second request.
4. **The pest id is kept, not a reference.** The catalog's pests are
   replaced on each import, so the table holds the dataset id without a
   foreign key. A mark for a pest a later release drops is never named; the
   API refuses to mark an id the catalog does not hold.
5. **Online only.** Marking a pest needs a connection; offline, the page says
   to try when online. Completing tasks still works offline as before.

## Consequences

- A household can cut its Scout tasks to the pests that matter where it
  gardens, without the dataset changing.
- Recording sightings (what was found, where, for next year's advice) is
  still to come and needs its own decision on who may record and where it
  is kept.
