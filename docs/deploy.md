# Deploying Open Garden

The [README](../README.md#install-with-docker) gets Open Garden running in four
steps. This page is the reference for everything after that: configuration,
reaching it from other devices, HTTPS, backups, and upgrades. It applies to any
Docker host — a laptop, a home server or NAS, or a cloud VM.

## What runs

| Container | Image | Purpose |
|---|---|---|
| `web` | `ghcr.io/thedude459/open-garden-web` (nginx, runs as uid 101) | Serves the app and proxies `/api` to the API. Published on port **8080**. |
| `api` | `ghcr.io/thedude459/open-garden-api` (Node, runs as uid 1000) | REST API. On start it waits for the database, applies pending migrations, and loads the plant catalog on first boot. Not published. |
| `postgres` | `postgres:16-alpine` | Data, in the `open-garden_pgdata` volume. Not published. |

All three start with `docker compose up -d` and restart automatically unless
you stopped them. Each release's `compose.yaml` pins the image version; set
`OPEN_GARDEN_VERSION` in `.env` to run a different one.

**Building from source** uses `docker-compose.yml` in the repository instead:
the same containers built locally, started with `docker compose --profile app
up -d --build`. It also publishes Postgres on `127.0.0.1:5432` for development.
Both files use the project name `open-garden`, so they share the same data
volume.

### Verifying an image

Release images carry an SBOM and signed build provenance. With the
[GitHub CLI](https://cli.github.com/):

```bash
gh attestation verify oci://ghcr.io/thedude459/open-garden-api:0.1.0 --owner thedude459
```

From the next release on, the release's `compose.yaml` is signed too
(`compose.yaml.sigstore.json` beside it). In the folder you downloaded it to:

```bash
gh attestation verify compose.yaml --owner thedude459
```

## Configuration

Put settings in `.env` next to `docker-compose.yml`, or set them as environment
variables in your host's Docker UI (common on a NAS). Never commit a real `.env`.

| Variable | Default | What it does |
|---|---|---|
| `POSTGRES_PASSWORD` | `open_garden` | Database password. Set your own before the **first** start: Postgres only reads it when it creates the `pgdata` volume. To change it later, change it inside Postgres too (see [Troubleshooting](#troubleshooting)). |
| `POSTGRES_USER`, `POSTGRES_DB` | `open_garden` | Database user and name. Same first-start rule. |
| `ADMIN_EMAIL` | unset | Gives the account with this email the admin role when the API starts. The account must already exist; see [Admin account](#admin-account). |
| `SEED_DEMO_USERS` | unset (off) | `true` creates `gardener@example.com` and `admin@example.com` with password `password123`. For trying the app only. |
| `PLACE_PROVIDER` | `live` | `live` uses real services for address lookup and map previews (OpenStreetMap Nominatim), hardiness zone and frost dates (phzmapi, FarmSense; US addresses today), and the rain outlook (Open-Meteo). `fixture` uses built-in sample data and makes no outside calls; the tests and `.env.example` use it. |
| `WEB_HOST` | `127.0.0.1` | Address the web port binds to on the host. `0.0.0.0` makes it reachable from other devices. |
| `WEB_PORT` | `8080` | Host port for the web container. |
| `COOKIE_SECURE` | `false` | Set `true` when people reach the app over HTTPS, so the session cookie is only sent over TLS. |
| `PLANT_CATALOG_FILE` | unset | Not needed: the image bundles the [open-garden-data](https://github.com/thedude459/open-garden-data/releases) release it was tested with and imports it when the API starts. To use a newer release before the app ships it, mount `open-garden-catalog-<version>.json` and its `open-garden-catalog-<version>.json.sigstore.json` (both from the release) into the API container and set this to the JSON file's path. A file whose provenance attestation does not verify, or that does not match the schema, fails that import and nothing changes. |
| `REMINDER_HOUR` | `7` | Hour of the day (0–23) the daily reminders go out, in the API container's time zone. |
| `TZ` | `UTC` | The API container's time zone, for example `Europe/Berlin`. Reminders and "today" on the server follow it. |
| `APP_URL` | unset | The address people open the app at, for example `https://garden.example.com`. Used for the link in reminder emails. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | unset (push off) | Turn on push reminders. Generate a pair once with `docker run --rm node:24-alpine npx -y web-push generate-vapid-keys` and keep it: a new pair makes every device turn push on again. Set both or neither. People reach the app over HTTPS for push to work in browsers. |
| `VAPID_SUBJECT` | `APP_URL` | A `mailto:` or `https:` contact that push services can use to reach the admin. |
| `SMTP_HOST`, `SMTP_FROM` | unset (email off) | Turn on the daily email summary: your mail server and the sender address. Set both. |
| `SMTP_PORT` | `587` | `465` uses TLS from the start; other ports upgrade with STARTTLS when the server offers it. |
| `SMTP_USER`, `SMTP_PASSWORD` | unset | Mail server login, if it needs one. |

The API's `DATABASE_URL`, `PORT`, and `NODE_ENV` are set by
`docker-compose.yml`; you do not need them in `.env`. `CORS_ORIGIN` only
matters for the development setup in [CONTRIBUTING.md](../CONTRIBUTING.md).

### Reminders

With push or email set up, the API sends each member one reminder a day at
`REMINDER_HOUR`: the watering, feeding, and harvest tasks due or overdue, as
on the Today page. Each member turns push on per device, and the daily email
on or off, at the bottom of the Today page. Nothing is sent to members who
have not turned it on. Push messages go through the browser maker's push
service (Google, Mozilla, Apple, or Microsoft); they are encrypted, and list
task names only. See [ADR 0022](adr/0022-reminder-delivery.md).

### Outside services

By default (`PLACE_PROVIDER=live`), the API sends the addresses people look up to OpenStreetMap Nominatim and the garden's coordinates to phzmapi.org,
FarmSense, and Open-Meteo, and browsers load the OpenStreetMap embed. These are
free services with usage policies (Nominatim allows about one request per
second; Open-Meteo's free tier is for non-commercial use). A household
install stays far inside them. If you host for many people, check their terms.

## Reaching it from other devices

1. Set `WEB_HOST=0.0.0.0` and run `docker compose up -d`.
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
docker compose stop api web
docker compose exec -T postgres pg_restore -U open_garden -d open_garden --clean --if-exists < open-garden-2026-11-08.dump
docker compose up -d
```

Use your own user and database names if you changed `POSTGRES_USER` or
`POSTGRES_DB`.

## Upgrading

```bash
docker compose exec -T postgres pg_dump -U open_garden -Fc open_garden > before-upgrade.dump
curl -fsSLO https://github.com/thedude459/open-garden/releases/latest/download/compose.yaml
docker compose up -d
```

Read the release notes first. To pick a specific version, download that
release's `compose.yaml` or set `OPEN_GARDEN_VERSION`. When building from
source, run `git pull && docker compose --profile app up -d --build` instead.

The API applies any new database migrations when it starts; each one runs once.
Check `docker compose logs api` if it does not become healthy.

Postgres itself stays on major version 16. A move to a newer major version
needs a dump and restore into a fresh volume; it will be documented when the
project makes that move.

## Admin account

The admin role is only needed for the plant-catalog pipeline page
(`/admin/pipeline`); the catalog loads by itself on first boot. To make your
own account an admin:

1. Register it in the app as usual.
2. Add `ADMIN_EMAIL=you@example.com` to `.env`.
3. Restart the API: `docker compose up -d --force-recreate api`.
   The log says `ADMIN_EMAIL: you@example.com has the admin role`.
4. Sign out and in again.

The setting only promotes an account that already exists, and only when the
API starts. Email addresses are not verified, so promoting at sign-up would
let whoever registers that address first become admin. Removing the setting
later does not take the role away.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bind: address already in use` naming 8080 or 5432 | Another program uses the port. Stop it, or set `WEB_PORT`. For 5432, stop the other Postgres. |
| `api` never becomes healthy | `docker compose logs api`. Common causes are below. |
| `ADMIN_EMAIL: no account for … yet` in the API log | Register that email in the app, then restart the API. |
| `password authentication failed for user` | `POSTGRES_PASSWORD` changed after the volume was created. Set it back, or change it in Postgres: `docker compose exec postgres psql -U open_garden -c "ALTER USER open_garden PASSWORD 'new-password'"`. |
| Address lookup returns sample places | `PLACE_PROVIDER` is set to `fixture`, often because `.env` was copied from `.env.example`. Remove it or set `live`. |
| Signing in seems to work, then you are back at the sign-in page | `COOKIE_SECURE=true` while the browser uses plain `http://`, so the browser drops the cookie. Use HTTPS, or set it back to `false`. |
