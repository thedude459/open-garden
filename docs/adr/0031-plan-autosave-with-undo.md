# ADR 0031: The plan saves itself, with undo

## Status

Accepted.

## Context

The plan (Garden Overview and Bed View) kept edits in a draft until the member
pressed **Save layout**. An "Unsaved changes" badge and a leave guard covered
the gap, and the redesign review (Phase 3 item 7) found both easy to miss.
A save sent new beds and direct-sown plants, a layout PUT, and deletes, using
lists the pages kept by hand as they changed the draft.

## Decision

1. **Save the difference.** A save compares the draft with the layout as last
   loaded or saved (`layoutChanges` in `garden-layout`) and sends what differs:
   new beds, new direct-sown plants, the layout PUT, then removed direct-sown
   plants and removed beds. Transplants are never created or deleted by the
   plan. No page keeps change lists any more.
2. **Autosave.** `PlannerDraftService.edit` records a change and saves it
   0.8 s after the last edit in a burst. Saves run one at a time; an edit made
   during a save goes in the next. A layout that breaks spacing or fit is not
   saved and says so ("Not saved: Too close, or past a bed edge") until it is
   fixed or undone, as Save refused it before. A failed request says why, with
   Retry.
3. **Undo, not redo.** Each burst of edits is one undo step (up to 50). Undo
   restores the earlier draft, keeping each bed's current name and settings
   (saved on their own as they change), and saves it like any edit, so
   undoing a bed that already saved deletes it on the server.
4. **Confirmed deletes are final.** Deleting a saved bed or walkway, or
   removing a saved direct-sown plant, asks first, happens at once (after any
   pending save), and clears the undo history. Deleting a planting on the
   server also drops its notes and photo, which undo could not bring back.
5. **Leaving.** Leaving the plan sends any pending edit and does not ask. It
   asks only when a save cannot go through (offline, refused, or blocked).
   Closing the tab warns while anything is unsaved, since it cannot wait.
6. **Online only, as before.** Plan edits still need a connection; the
   offline queue for plantings is unchanged.

## Consequences

+ No Save button to forget; the status line says what happened.
+ Undo covers moves, resizes, rotations, new beds and walkways, and placed
  plants.
+ Saving is easier to reason about: one comparison instead of three lists.
- More requests: a save after each burst of edits rather than one per
  session. At household scale this is a few small requests a minute at most.
- Removing a saved plant is immediate; there is no "undo delete".
- Browser tests wait for **All changes saved**. The helper first lets the page
  render one frame, because Angular shows "Saving…" a moment after the edit.
