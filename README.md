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
npm run dev
```

Open http://localhost:3000 — register an account, then browse `/plants`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run seed:reference` | Seed curated plants + relationships |
| `npm run sync:plants` | Run Trefle/Perenual sync job |
| `npm run perf:search` | SC-007 search timing smoke test |

## Architecture

Next.js 15 App Router monolith with PostgreSQL (Drizzle ORM), Auth.js credentials,
server-side plant catalog, scoped offline cache via service worker, and curated
companion/rootstock reference data.

See `specs/001-plant-database/` for full specification and contracts.
