# Open Garden

A self-hosted garden planner for households. Lay out beds on a scaled map of
your property, record what you plant each season, see sowing and transplant
windows for your frost dates, and keep up with watering and other care. Share a
property with the rest of your household.

It runs as three containers (web, API, and PostgreSQL) on any machine with
Docker: a laptop, a home server or NAS, or a cloud VM.

## Install with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Compose v2
(`docker compose version` should work) and about 1 GB of disk.

1. Get the code:

   ```bash
   git clone https://github.com/thedude459/open-garden.git
   cd open-garden
   ```

2. Create `.env` next to `docker-compose.yml`:

   ```bash
   cat > .env <<EOF
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   SEED_DEMO_USERS=false
   PLACE_PROVIDER=live
   EOF
   ```

   `PLACE_PROVIDER=live` turns on real address lookup, map previews, frost
   dates, hardiness zones, and the rain outlook (OpenStreetMap, Open-Meteo, and
   others; no API keys). Leave it out to use built-in sample data instead.

3. Start it:

   ```bash
   docker compose --profile app up -d --build
   ```

   The first start builds the images and loads the plant catalog; give it a
   few minutes. `docker compose ps` shows `api` as `healthy` when it is ready.

4. Open **<http://127.0.0.1:8080>** and choose **Need an account?** to register.
   Add a property, then invite the rest of your household from its
   **Configuration** page.

By default the app only listens on this machine. To reach it from other
devices, or to put it behind HTTPS, see **[docs/deploy.md](docs/deploy.md)**.

### Try it with demo data

For a quick look instead of a real install, skip step 2 and run
`cp .env.example .env` before step 3. Then sign in as
`gardener@example.com` / `password123`; addresses and weather use built-in
sample data. Do not use those settings for a garden other people rely on.

## Day to day

| Task | Command |
|---|---|
| Stop (data is kept) | `docker compose --profile app stop` |
| Start again | `docker compose --profile app up -d` |
| Update to the latest version | `git pull && docker compose --profile app up -d --build` |
| See logs | `docker compose logs -f api` |
| Back up the database | see [docs/deploy.md](docs/deploy.md#backups) |

Database changes are applied automatically when the API starts. Your data lives
in the `pgdata` Docker volume; `docker compose down -v` **deletes it**, so leave
off `-v` unless that is what you want.

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
(section 13). The plant dataset will be published separately under CC0.
