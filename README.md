# Plant Database — Local Development

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

## Quick start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run seed:reference
npm run seed:planner-assets
npm run dev
```

Open http://localhost:3000 — register an account, then browse `/plants` or create a garden at `/gardens/new`.

## Visual garden planner (Feature 003)

The garden editor at `/gardens/[id]` uses the illustrated **PlannerShell** with:

- Drag-and-drop plants and structures on a zoomable canvas
- Zone types: vegetable garden, orchard, container / patio
- Starter templates on the new-garden form
- Plan thumbnails saved via **Save plan** (stored under `public/planner/thumbnails/`)

Seed illustration assets and templates:

```bash
npm run seed:planner-assets
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run seed:reference` | Seed curated plants + relationships |
| `npm run seed:planner-assets` | Seed planner illustrations, structures, templates |
| `npm run bench:planner-canvas` | SC-003a drag projection latency bench |
| `npm run sync:plants` | Run Trefle/Perenual sync job |
| `npm run perf:search` | SC-007 search timing smoke test |

## Architecture

Next.js 15 App Router monolith with PostgreSQL (Drizzle ORM), Auth.js credentials,
server-side plant catalog, scoped offline cache via service worker, curated
companion/rootstock reference data, and an SVG-based visual garden planner.

See `specs/001-plant-database/` for the plant catalog and `specs/003-visual-planner-ui/` for the planner feature.
