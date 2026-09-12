# ADR 0015: Compose stack for API, web, and Postgres

## Status

Accepted

## Context

Constitution requires self-hosted deploy config in the repository. Compose today starts only Postgres; operators run Nest and Angular on the host. Spec 013 needs the whole app via Compose, one gardener origin, a data store that can run alone, localhost for laptop testing, and NAS access at the NAS IP with secrets from the NAS Docker UI.

## Decision

1. **One Compose file**, profile `app` for `api` and `web`. `postgres` stays unprofiled and startable alone. Volume `pgdata` is not removed by stopping UI/API.
2. **Same origin**: web image is nginx + Angular production build; `/api` is proxied to the api container. Browser keeps relative `/api`.
3. **Bind**: default `WEB_HOST=127.0.0.1` (local testing). NAS sets `0.0.0.0`. Postgres published on loopback `:5432` for host tools.
4. **Secrets**: local `.env`; NAS interpolates env from the NAS UI. Api container `DATABASE_URL` uses hostname `postgres`, not the host `.env` localhost URL.
5. **HTTP cookies**: `Secure` only when `COOKIE_SECURE=true`. Do not tie `Secure` to `NODE_ENV=production`.
6. **Boot**: wait for Postgres, **only** Drizzle migrate for schema (`migrations/meta/_journal.json` plus the SQL files), then `sync-cli --seed-only` if the catalog is empty. Do not apply SQL twice. CI e2e stays on host serve + postgres-only Compose. Stacked origin is proven with `STACK_E2E=1` Playwright against `:8080` (not in the merge-gate script).
7. **PWA**: nginx must not cache `ngsw.json` / `ngsw-worker.js` or SPA-fallback those paths.

## Consequences

+ NAS can keep Postgres up while restarting the app; laptop bind stays loopback.
+ No API URL baked into the SPA; NAS IP can change.
- Two app images to build; first boot includes a fixture pipeline.
- Host `.env` `DATABASE_URL=localhost` must not be copied verbatim into the api container.
- Production TLS is still out of scope; LAN HTTP is the NAS path.
- Stacked Playwright (`STACK_E2E=1`) is implement-time, not the merge-gate `e2e` job.
- `sync-cli --seed-only` after Drizzle migrate; unflagged `sync-cli` still applies SQL for host `api:sync-plants`.
