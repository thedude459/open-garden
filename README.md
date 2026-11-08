# Open Garden

[![CI](https://github.com/thedude459/open-garden/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/thedude459/open-garden/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thedude459/open-garden)](https://github.com/thedude459/open-garden/releases/latest)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/thedude459/open-garden/badge)](https://scorecard.dev/viewer/?uri=github.com/thedude459/open-garden)

A self-hosted garden planner for households. Lay out beds on a scaled map of
your property, record what you plant each season, see sowing and transplant
windows for your frost dates, and keep up with watering and other care. Share a
property with the rest of your household.

It runs as three containers (web, API, and PostgreSQL) on any machine with
Docker: a laptop, a home server or NAS, or a cloud VM.

> **Project status: early (0.x).** Open Garden is usable but young. Expect
> changes between minor versions (0.1 → 0.2), [back up](docs/deploy.md#backups)
> before upgrading, and read the release notes. Version 1.0 will mark a stable
> data model and supported upgrades.

## Install with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Compose v2
(`docker compose version` should work) and about 1 GB of disk. Images are
published for 64-bit Intel/AMD and ARM machines (including Apple Silicon and
Raspberry Pi 4/5), so there is nothing to build.

1. Make a folder and download the latest release's `compose.yaml`:

   ```bash
   mkdir open-garden && cd open-garden
   curl -fsSLO https://github.com/thedude459/open-garden/releases/latest/download/compose.yaml
   ```

2. Create `.env` next to it:

   ```bash
   cat > .env <<EOF
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   SEED_DEMO_USERS=false
   EOF
   ```

   Address lookup, map previews, frost dates, hardiness zones, and the rain
   outlook use free online services (OpenStreetMap, Open-Meteo, and others; no
   API keys). To keep the app offline with built-in sample data instead, add
   `PLACE_PROVIDER=fixture`.

3. Start it:

   ```bash
   docker compose up -d
   ```

   The first start downloads the images and loads the plant catalog.
   `docker compose ps` shows `api` as `healthy` when it is ready.

4. Open **<http://127.0.0.1:8080>** and choose **Need an account?** to register.
   Add a property, then invite the rest of your household from its
   **Configuration** page.

By default the app only listens on this machine. To reach it from other
devices, or to put it behind HTTPS, see **[docs/deploy.md](docs/deploy.md)**.

### Try it with demo data

For a quick look instead of a real install, use this `.env` in step 2:

```bash
SEED_DEMO_USERS=true
PLACE_PROVIDER=fixture
```

Then sign in as `gardener@example.com` / `password123`; addresses and weather
use built-in sample data. Do not use those settings for a garden other people
rely on.

### Build from source

To run your own changes, clone the repository, create the same `.env` next to
`docker-compose.yml`, and run `docker compose --profile app up -d --build`.
Development without Docker is covered in [CONTRIBUTING.md](CONTRIBUTING.md).

## Day to day

Run these in the folder with `compose.yaml` and `.env`.

| Task | Command |
|---|---|
| Stop (data is kept) | `docker compose stop` |
| Start again | `docker compose up -d` |
| Update to the latest release | download the new `compose.yaml` (step 1), then `docker compose up -d` |
| See logs | `docker compose logs -f api` |
| Back up the database | see [docs/deploy.md](docs/deploy.md#backups) |

Database changes are applied automatically when the API starts. Your data lives
in the `open-garden_pgdata` Docker volume; `docker compose down -v` **deletes
it**, so leave off `-v` unless that is what you want.

## More

- [docs/deploy.md](docs/deploy.md) — configuration reference, network access,
  HTTPS, backups, upgrades, troubleshooting
- [CONTRIBUTING.md](CONTRIBUTING.md) — development setup, tests, and project layout
- [SECURITY.md](SECURITY.md) — reporting a vulnerability
- [docs/roadmap.md](docs/roadmap.md) — where the project is going

## License

Open Garden is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE)
(`AGPL-3.0-or-later`). You may use, modify, and self-host it. If you run a modified
version for other people over a network, you must offer them its source code
(section 13); the app's **Source code** link does this — point
`apps/web/src/app/source-link.ts` at your modified source. The plant dataset will be published separately under CC0.
