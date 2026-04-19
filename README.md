# open-garden

Dockerized community-ready vegetable garden management app.

## What is included

- FastAPI backend with PostgreSQL
- Basic username/password auth
- Private-by-default gardens with optional public sharing
- Multi-garden support per user
- Bed list + visual grid planner coordinates
- Planting creation with automatic task templates
- Task search/filter endpoint
- Weather integration (Open-Meteo) by GPS coordinates
- Seed inventory and pest log tracking
- Basic admin tools to list/disable users
- Backup and restore scripts for DB snapshots

## Quick start

1. Create environment file:

```bash
cp .env.example .env
```

2. Rebuild images and deploy the stack (single command):

```bash
./scripts/rebuild.sh
```

`scripts/rebuild.sh` behavior:

- Rebuilds the `api` and `web` images with `--no-cache`.
- If `DATABASE_URL` is set in `.env`, it deploys in external PostgreSQL mode.
- If `DATABASE_URL` is empty, it deploys with local PostgreSQL automatically.

3. Open apps:

- Web UI: http://localhost:5173
- API docs: http://localhost:8000/docs

If startup fails with Docker daemon errors, start Docker Desktop (or your Docker engine) and run `./scripts/rebuild.sh` again.

## Run locally (developer machine)

1. Create `.env` from the template:

```bash
cp .env.example .env
```

2. Leave `DATABASE_URL` empty in `.env` to use local containerized Postgres.

3. Rebuild and start services:

```bash
./scripts/rebuild.sh
```

4. Stop services:

```bash
docker compose -f docker-compose.yml -f docker-compose.localdb.yml down
```

5. Reset local DB data (optional, destructive):

```bash
docker compose -f docker-compose.yml -f docker-compose.localdb.yml down -v
```

Optional fast start without forced no-cache rebuild:

```bash
./scripts/up.sh
```

## Local SMTP testing (Mailpit)

When `DATABASE_URL` is empty (local Docker mode), [docker-compose.localdb.yml](docker-compose.localdb.yml) starts a Mailpit SMTP catcher automatically.

- SMTP host from API container: `mailpit`
- SMTP port: `1025`
- Mail UI on host: `http://localhost:8025`

### End-to-end test flow

1. Start stack:

```bash
./scripts/rebuild.sh
```

2. Register a new account or trigger forgot-password in the app.
3. Open Mailpit inbox: `http://localhost:8025`
4. Open the verification/reset links from captured emails.

To use a real SMTP provider locally instead of Mailpit, set `SMTP_HOST`, `SMTP_PORT`, and related SMTP variables in `.env`.

## Deploy on a NAS / home server

1. Install Docker and Docker Compose plugin on the NAS.

2. Clone this repo on the NAS and create `.env`:

```bash
cp .env.example .env
```

3. Choose DB mode in `.env`:

- Set `DATABASE_URL` to use an external Postgres service, or
- Leave `DATABASE_URL` empty to run local Postgres in Docker.

4. For remote access, set API URL used by the web container:

- Example: `VITE_API_URL=http://<NAS_IP_OR_HOSTNAME>:8000`

5. Rebuild and start services:

```bash
./scripts/rebuild.sh
```

6. Optional: run on boot via NAS task scheduler (run from repo root):

```bash
./scripts/rebuild.sh
```

7. Optional: schedule backups:

```bash
./scripts/backup.sh
```

## First login flow

- Use any username/password in the web UI.
- UI tries register first, then login.
- After login, create gardens, beds, and tasks.

## Important API behavior

- `GET /gardens/public` never returns `address_private`.
- `POST /plantings` auto-generates baseline tasks from planting date.

## Backups

Create backup:

```bash
./scripts/backup.sh
```

Restore backup:

```bash
./scripts/restore.sh backups/opengarden_YYYYMMDD_HHMMSS.sql
```

For NAS deployment, schedule `backup.sh` via cron and also snapshot Docker volumes.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SECRET_KEY` | **Yes** | — | JWT signing secret. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `DATABASE_URL` | No | local Docker Postgres | Full SQLAlchemy URL. Leave empty to use bundled Postgres. |
| `ENV` | No | `development` | Set to `production` to raise an error on insecure defaults. |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:4173` | Comma-separated CORS origins. Override with your domain in production. |
| `VITE_API_URL` | No | `http://localhost:8000` | Browser-facing API URL. Override when deploying to a non-localhost host. |
| `FRONTEND_BASE_URL` | No | `http://localhost:5173` | Base URL included in email verification/reset links. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | JWT lifetime in minutes. |
| `EMAIL_VERIFICATION_EXPIRE_MINUTES` | No | `60` | Verification link lifetime in minutes. |
| `PASSWORD_RESET_EXPIRE_MINUTES` | No | `30` | Password reset link lifetime in minutes. |
| `SMTP_HOST` | No | empty | SMTP server hostname override. In local Docker mode it defaults to `mailpit` when unset. |
| `SMTP_PORT` | No | `587` | SMTP server port override. In local Docker mode it defaults to `1025` when unset. |
| `SMTP_USERNAME` | No | empty | SMTP auth username. |
| `SMTP_PASSWORD` | No | empty | SMTP auth password. |
| `SMTP_FROM_EMAIL` | No | `noreply@open-garden.local` | From address for verification/reset emails. |
| `SMTP_USE_TLS` | No | `true` | Whether to use STARTTLS when sending SMTP email. Local Mailpit default is `false`. |
| `GLOBAL_RATE_LIMIT_PER_MINUTE` | No | `180` | Per-process global request cap per IP per minute. |
| `AUTH_LOGIN_LIMIT_PER_MINUTE` | No | `5` | Login attempts per IP+username per minute. |
| `AUTH_REGISTER_LIMIT_PER_MINUTE` | No | `5` | Registration attempts per IP+username per minute. |
| `AUTH_VERIFY_LIMIT_PER_MINUTE` | No | `20` | Email verification token submissions per IP per minute. |
| `AUTH_RESET_LIMIT_PER_MINUTE` | No | `10` | Password reset submissions per IP per minute. |
| `AUTH_FORGOT_LIMIT_PER_HOUR` | No | `8` | Forgot-password requests per IP+email per hour. |
| `AUTH_RESEND_LIMIT_PER_HOUR` | No | `12` | Verification resend requests per IP+email per hour. |

In `ENV=production`, `SMTP_HOST` is required and startup fails if it is not configured, to prevent verification/reset links from being logged.

## Migrations

Database schema changes are managed with **Alembic**.

Create a new migration after editing `backend/app/models.py`:

```bash
docker compose exec api alembic revision --autogenerate -m "describe your change"
```

Migrations run automatically at startup via `alembic upgrade head`.

## Linting

Use the following strategy to keep backend, frontend, docs, and YAML consistent:

1. Backend Python linting and formatting checks with Ruff.
2. Frontend React/TypeScript linting with ESLint.
3. Documentation linting with markdownlint.
4. YAML linting with yamllint.
5. Unified enforcement via pre-commit.

Install lint dependencies:

```bash
pip install -r backend/requirements-dev.txt
cd frontend && npm ci
```

Run all lint checks through pre-commit (recommended):

```bash
pre-commit run --all-files
```

Install and enable the pre-commit hook so all linting runs before each commit:

```bash
pre-commit install
```

Run the same pre-commit lint checks manually at any time:

```bash
pre-commit run --all-files
```

CI runs the same pre-commit lint suite in `.github/workflows/lint.yml` and as a required job in `.github/workflows/ci.yml`.

## Backend tests

Run backend tests locally with a Dockerized Python 3.12 runner (works even if your host Python version differs):

```bash
./scripts/test-backend.sh
```

Run only backend unit tests:

```bash
./scripts/test-backend-unit.sh
```

Run only backend integration tests:

```bash
./scripts/test-backend-integration.sh
```

Test split and markers:

- Unit tests are fast, isolated tests.
- Integration tests validate multi-module behavior, app wiring, middleware, migrations, or database flows.
- Tests without an explicit marker are auto-classified as `unit` during collection.

This command runs `pytest backend/tests -q` with coverage and writes:

- `backend/coverage.xml`
- `backend/htmlcov/`

`scripts/test-backend.sh` executes two phases in order:

1. Unit tests (`-m unit`)
2. Integration tests (`-m integration`)

Coverage is combined across both phases and branch coverage is enforced.

CI safety checks:

- Backend unit and integration jobs run as separate checks.
- A coverage gate job enforces line and branch thresholds after both phases.
- CI uses randomized test order with a reported `pytest-randomly` seed to catch order dependencies.

The CI backend test job in `.github/workflows/ci.yml` uses the same script.
