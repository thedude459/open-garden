# Quickstart: Garden View Clarity

**Feature**: `014-garden-view-clarity`

Operator/gardener proof for [spec.md](./spec.md). Destinations: [contracts/garden-ui.md](./contracts/garden-ui.md).

## Prerequisites

Host workflow (or stacked app): signed in, Postgres up, catalog seeded. Demo: `gardener@example.com` / `password123`.

```bash
npm run api:serve   # if host path
npm run web:serve
```

## 1. Open a garden, see the garden (SC-001)

1. Gardens list → Create a garden with at least one named sized bed (Overview: Create bed, Save layout) **or** use a garden that already has beds.
2. Go to **Gardens** and click that garden.
3. **Expect**: heading **Garden Overview** and the map. **Do not** see **Garden settings**, the member list, or **Delete garden** as the main body. A newly created garden with **no beds** still lands here (empty guidance), not configuration.
4. On the plan, a bed shows **name and size** (e.g. `Bed · … · 8 × 4 ft`). Occupied beds still show planting names (and counts) **on the bed**. The Overview plan must **not** draw in-bed planting circles.

## 2. Configuration still works (SC-003, SC-004)

1. From Overview, open **Configuration**.
2. Change name or zone; Save garden. Return to Overview in **one** nav click (**Garden Overview**). Name in the header matches.
3. Owner: invite a member; **Delete garden** still asks to confirm (do not confirm on a garden you need for step 3).

## 3. Quiet Bed View (SC-002)

1. Open a bed that has **two nearby plantings** with the same common name (e.g. two Sweet Basil).
2. **Expect**: each mark shows a **short prefix on the circle**. The plan does **not** show `Bed · {name} · {size}` or a second full name beside the marks.
3. You-are-here / heading may still name the bed. **Size is not listed** on this screen.
4. Select one mark. **Expect**: full common name in one status/detail line **off** the plan. Click empty plan: that line clears. An empty bed still has no `Bed ·` size caption and no empty name stack.

## 4. Viewer (SC-005)

Sign in as a viewer of that garden. Open from the list → Overview. Open Configuration → can **read** members; cannot Save / Invite / Delete. Bed View: same quiet marks; cannot drag plantings.

## Automated

```bash
npm test          # includes garden-layout truncation tests
npm run e2e       # host Playwright (update landing/configure/bed-label specs)
```

## What not to do

- Do not add a nickname field or initials-only codes.
- Do not put settings back on Overview.
- Do not draw in-bed planting positions on Overview.
- Do not `docker compose down -v` to “test” this feature.
