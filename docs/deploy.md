# Deploying Open Garden

The [README](../README.md#install-with-docker) gets Open Garden running in four
steps. This page is the reference for everything after that: configuration,
reaching it from other devices, HTTPS, backups, and upgrades. It applies to any
Docker host — a laptop, a home server or NAS, or a cloud VM.

## What runs

| Container | Image | Purpose |
|---|---|---|
| `web` | built from `Dockerfile.web` (nginx, runs as uid 101) | Serves the app and proxies `/api` to the API. Published on port **8080**. |
| `api` | built from `Dockerfile.api` (Node, runs as uid 1000) | REST API. On start it waits for the database, applies pending migrations, and loads the plant catalog on first boot. Not published. |
| `postgres` | `postgres:16-alpine` | Data, in the `pgdata` volume. Published on `127.0.0.1:5432` only, for local development. |

`web` and `api` start with `docker compose --profile app …`; `postgres` starts
with them, or on its own with plain `docker compose up -d postgres`. All three
restart automatically unless you stopped them.

## Configuration

Put settings in `.env` next to `docker-compose.yml`, or set them as environment
variables in your host's Docker UI (common on a NAS). Never commit a real `.env`.

| Variable | Default | What it does |
|---|---|---|
| `SESSION_SECRET` | — (**required**) | Must be set or the API refuses to start, and must not be the example value when `SEED_DEMO_USERS=false`. Generate one with `openssl rand -hex 32`. *Sessions are currently random tokens stored hashed, so this value is not yet used to sign anything; it is checked so a real secret is in place when it is.* |
| `POSTGRES_PASSWORD` | `open_garden` | Database password. Set your own before the **first** start: Postgres only reads it when it creates the `pgdata` volume. To change it later, change it inside Postgres too (see [Troubleshooting](#troubleshooting)). |
| `POSTGRES_USER`, `POSTGRES_DB` | `open_garden` | Database user and name. Same first-start rule. |
| `SEED_DEMO_USERS` | unset (off) | `true` creates `gardener@example.com` and `admin@example.com` with password `password123`. For trying the app only. |
| `PLACE_PROVIDER` | `fixture` | `live` uses real services for address lookup and map previews (OpenStreetMap Nominatim), hardiness zone and frost dates (phzmapi, FarmSense; US addresses today), and the rain outlook (Open-Meteo). `fixture` uses built-in sample data and makes no outside calls. |
| `WEB_HOST` | `127.0.0.1` | Address the web port binds to on the host. `0.0.0.0` makes it reachable from other devices. |
| `WEB_PORT` | `8080` | Host port for the web container. |
| `COOKIE_SECURE` | `false` | Set `true` when people reach the app over HTTPS, so the session cookie is only sent over TLS. |
| `PLANT_PROVIDER`, `PERENUAL_API_KEY` | `fixture`, unset | Optional extra plant source for the catalog pipeline. Not needed. |

The API's `DATABASE_URL`, `PORT`, and `NODE_ENV` are set by
`docker-compose.yml`; you do not need them in `.env`. `CORS_ORIGIN` only
matters for the development setup in [CONTRIBUTING.md](../CONTRIBUTING.md).

### Outside services

With `PLACE_PROVIDER=live`, the API calls OpenStreetMap Nominatim, phzmapi.org,
FarmSense, and Open-Meteo, and browsers load the OpenStreetMap embed. These are
free services with usage policies (Nominatim allows about one request per
second; Open-Meteo's free tier is for non-commercial use). A household
install stays far inside them. If you host for many people, check their terms.

## Reaching it from other devices

1. Set `WEB_HOST=0.0.0.0` and run `docker compose --profile app up -d`.
2. Open `http://<host-ip>:8080` from another device on the same network.
3. Allow the port in the host's firewall if needed. To use port 80, set
   `WEB_PORT=80` or map host port 80 to container port 8080 in your Docker UI.

Anyone who can reach the page can register an account, and accounts only see
properties they own or were invited to. Do not expose port 8080 directly to the
internet; put HTTPS in front of it (next section) or use a VPN.

## HTTPS

Run a TLS-terminating reverse proxy in front of the `web` container and set
`COOKIE_SECURE=true`. With [Caddy](https://caddyserver.com/), which gets a
certificate automatically:

```caddyfile
garden.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Any proxy works (nginx, Traefik, your NAS's reverse proxy, a Cloudflare
Tunnel). Keep `WEB_HOST=127.0.0.1` if the proxy runs on the same machine.

Set `COOKIE_SECURE=true` explicitly: the `web` container's nginx passes its own
scheme (`http`) to the API, so the API cannot tell from headers that the
browser used HTTPS. The `web` container already sends a strict
Content-Security-Policy and other security headers; add HSTS at your proxy
once HTTPS works.

## Backups

Everything is in Postgres. Back up with `pg_dump`, which works while the app is
running:

```bash
docker compose exec -T postgres pg_dump -U open_garden -Fc open_garden > open-garden-$(date +%F).dump
```

Keep copies somewhere other than this machine. To restore a dump, stop the API
first, then load it over the current data:

```bash
docker compose --profile app stop api web
docker compose exec -T postgres pg_restore -U open_garden -d open_garden --clean --if-exists < open-garden-2026-11-08.dump
docker compose --profile app up -d
```

Use your own user and database names if you changed `POSTGRES_USER` or
`POSTGRES_DB`.

## Upgrading

```bash
docker compose exec -T postgres pg_dump -U open_garden -Fc open_garden > before-upgrade.dump
git pull
docker compose --profile app up -d --build
```

The API applies any new database migrations when it starts; each one runs once.
Check `docker compose logs api` if it does not become healthy.

Postgres itself stays on major version 16. A move to a newer major version
needs a dump and restore into a fresh volume; it will be documented when the
project makes that move.

## Admin account

The admin role is only needed for the plant-catalog pipeline page
(`/admin/pipeline`); the catalog loads by itself on first boot. Today the only
way to get an admin is `SEED_DEMO_USERS=true`, which is not suitable for real
use. A way to promote your own account is on the [roadmap](roadmap.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bind: address already in use` naming 8080 or 5432 | Another program uses the port. Stop it, or set `WEB_PORT`. For 5432, stop the other Postgres. |
| `api` never becomes healthy | `docker compose logs api`. Common causes are below. |
| `SESSION_SECRET is required` / `must not be the example value` | Set a real `SESSION_SECRET` in `.env` (see [Configuration](#configuration)). |
| `password authentication failed for user` | `POSTGRES_PASSWORD` changed after the volume was created. Set it back, or change it in Postgres: `docker compose exec postgres psql -U open_garden -c "ALTER USER open_garden PASSWORD 'new-password'"`. |
| Address lookup returns sample places | `PLACE_PROVIDER` is not `live`. |
| Signing in seems to work, then you are back at the sign-in page | `COOKIE_SECURE=true` while the browser uses plain `http://`, so the browser drops the cookie. Use HTTPS, or set it back to `false`. |
