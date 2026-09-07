# api-e2e

Zod contract smokes run in `npm test` (no server).

Live HTTP proofs (`*-http.spec.ts`) run only when `E2E_LIVE=1` against `http://localhost:3000`. See `apps/web-e2e/CONVENTION.md` for layering.
