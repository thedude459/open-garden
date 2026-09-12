# Feature Specification: Dockerize Full Application

**Feature Branch**: `013-dockerize-app`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "dockerize the frontend and api. Make it so the whole app, including any dependencies can be run via docker compose"

## Clarifications

### Session 2026-09-07

- Q: When the full stack is running, should an operator open one web address for both the pages and the API, or keep separate addresses like today’s local setup? → A: One address: the operator opens a single web URL; the API is on that same origin (no second URL for the default run)
- Q: When the full stack is running, should the data store be reachable from the host machine, or only from the other parts of the stack? → A: Own container, can run by itself; reachable from the host even during a full-stack run
- Q: Should the documented web address be reachable only from the same machine, or also from other devices on the local network? → A: Two modes. Production (NAS): open the app at the NAS IP on the local network; data store runs by itself; UI and API run separately from the data store. Local testing: localhost only.
- Q: For secrets (data-store password, session secret), how should local testing vs NAS production behave? → A: Local testing uses the project `.env` file; NAS production secrets come from the NAS Docker/container setup (not from committed files)

## User Scenarios & Testing *(mandatory)*

The people who use this feature are **operators** (someone running Open Garden on a **NAS** as production, or testing on a laptop) and **contributors** (inner-loop work on a laptop). Gardeners do not see new screens; they open the app at the NAS IP in production. The constitution already requires self-hosted deployment with stack configuration in the repository; today only the data store is started that way, while the web client and API still require a local language runtime.

There are **two documented run modes**:

- **Local testing**: the app is reached only at `http://127.0.0.1:8080` (loopback; not a LAN IP).
- **Production (NAS)**: the data store can run by itself; the UI and API run as a separate stack; gardeners open a single origin at the NAS IP (`http://<NAS-IP>:8080`).

### User Story 1 - Local Testing On Localhost (Priority: P1)

A contributor on a laptop starts the stacked web client, API, and data store with a documented command (or starts the data store alone and uses host web/API). They reach the app only at **`http://127.0.0.1:8080`**. They do not install a language runtime or a database on the host for the stacked path. Pages and API share that origin.

**Why this priority**: Daily verification must stay simple and not bind the laptop’s app to the LAN.

**Independent Test**: On a machine with the container runtime, follow the documented **local testing** start. Confirm `http://127.0.0.1:8080` loads and API calls stay on that origin. A device on the LAN does not need to reach this local-testing run.

**Acceptance Scenarios**:

1. **Given** a laptop with the container runtime and the repository, **When** the contributor runs the documented local-testing start, **Then** the web client, API, and data store run as containers (data store is its own container) and **`http://127.0.0.1:8080`** serves the app without a host language runtime or local database.
2. **Given** that local-testing start has succeeded, **When** they open `http://127.0.0.1:8080`, **Then** sign-in (or landing) loads and page requests to the API use that same origin (no second URL).
3. **Given** local testing is running, **When** they inspect what is advertised as the web address, **Then** it is loopback (`127.0.0.1`), not a LAN/NAS production address.

---

### User Story 2 - The Running App Is Usable (Priority: P1)

After the stack is up (`http://127.0.0.1:8080` for local testing, or `http://<NAS-IP>:8080` for production), an operator can sign in as a documented demo gardener and use the product (see gardens, browse plants). Schema updates apply as part of bringing the API up. Catalog and demo data needed for a first visit are present without a separate host-side seed command. The web client talks to this stack’s API on the same origin as the documented web address, without the operator editing connection settings by hand.

**Why this priority**: A stack that is “up” but empty, unmigrated, or pointed at the wrong API is not a running app.

**Independent Test**: After one start command (and any documented first-boot wait), sign in with a documented demo account and complete one gardener action (for example, open gardens or the plant catalog). No extra seed or migrate command on the host.

**Acceptance Scenarios**:

1. **Given** a first-time start with empty stored data, **When** the API becomes ready, **Then** required data-structure updates have already been applied so ordinary requests succeed (not “relation does not exist” failures).
2. **Given** that first-time start, **When** a gardener signs in with a documented demo account, **Then** they can use the app (catalog is populated enough to browse; demo gardener exists) without running a separate seed command on the host.
3. **Given** the web client served by the stack, **When** it calls the API, **Then** those calls use the same origin as the documented web address for that mode (`http://127.0.0.1:8080` when local testing; `http://<NAS-IP>:8080` when production) — the operator does not paste a second API URL into a config file for the documented run.

---

### User Story 3 - NAS Production: Data Store Alone, App At The NAS IP (Priority: P1)

An operator on a local NAS keeps the **data store running by itself**. They start (and stop) the **UI and API separately** from the data store so the database can stay up when the app stack is restarted. Gardeners open **one web origin at the NAS IP** (pages and API on that same origin). No extra reverse-proxy product beyond what the stack documents is required for this default production path.

**Why this priority**: This is the production setup. A stacked laptop demo is not a substitute for “DB stays up; open the app at the NAS address.”

**Independent Test**: Start only the data store. Start UI and API without restarting the data store. From another device on the same network, open `http://<NAS-IP>:8080` and sign in. Stop UI and API; the data store is still running and data is intact. Start UI and API again and the garden is still there.

**Acceptance Scenarios**:

1. **Given** a NAS with the container runtime, **When** the operator starts only the data store, **Then** it runs without the UI or API.
2. **Given** that data store is already running, **When** they start the UI and API, **Then** those start without recreating or wiping the data store, and they use that existing data store.
3. **Given** UI and API are up on the NAS, **When** a gardener on the local network opens `http://<NAS-IP>:8080`, **Then** the app loads and API calls use that same origin (no second URL).
4. **Given** UI and API are running, **When** the operator stops only the UI and API, **Then** the data store keeps running and persisted gardens remain.

---

### User Story 4 - Restarts Keep Data; Secrets Stay Out of the Recipe (Priority: P2)

An operator can stop the stack and start it again and still have gardens, members, and plantings they created. Secrets (data-store password, session secret) are not committed as production values. **Local testing** supplies them via the project `.env` file. **NAS production** supplies them via the NAS Docker/container setup.

**Why this priority**: Self-hosting is useless if a reboot wipes the garden, and unsafe if production secrets live in the repository.

**Independent Test**: Create a garden while the stack is up, restart UI/API (data store left running), sign in again, and confirm the garden is still there. Confirm the repository does not contain production credentials. Local testing reads `.env`; NAS run reads secrets from the NAS Docker setup.

**Acceptance Scenarios**:

1. **Given** a gardener created a garden while the stack was running, **When** the operator stops and starts UI/API (or the data store), **Then** that garden is still present after sign-in.
2. **Given** the files in the repository, **When** a reviewer looks for secrets, **Then** they find no production credentials. A documented `.env` example MAY exist for local testing; it MUST NOT be the NAS production source.
3. **Given** local testing, **When** the contributor has a `.env` file, **Then** the stacked run uses those values without changing application source.
4. **Given** NAS production, **When** the operator has set secrets in the NAS Docker setup, **Then** the stacked UI/API and data store use those values. If those secrets are missing, start fails with a message naming the missing setting.

---

### User Story 5 - Native Local Workflow Still Works (Priority: P3)

A contributor who already runs the web client and API with the existing host commands (and only the data store in the stack) can still do that. The data store is a **separate container** that can start **by itself**, without the web client or API. While the full stack is up, that same data store remains reachable from the host so a host-run API or tools can connect. This feature adds a full-stack run path; it does not remove the current local development path.

**Why this priority**: Daily coding should not require rebuilding container images. The new path is for “run the whole product”; the old path stays for inner-loop work, and the data store must remain a standalone piece.

**Independent Test**: Start only the data store (no stacked web or API), then start host web and API and sign in. Separately, with the full stack up, confirm a host process can still connect to the data store on the documented host address.

**Acceptance Scenarios**:

1. **Given** the data store running from the stack and no containerized web or API, **When** a contributor starts the API and web client with the existing host commands, **Then** the app works as it does today (web talks to API, API talks to the data store).
2. **Given** documentation, **When** a new contributor chooses a path, **Then** they can tell which command starts the **full** stack, which command starts **only the data store**, and which commands start **host** web/API against that data store.
3. **Given** the full stack is running, **When** a host-run API or tool uses the documented data-store address on the host, **Then** it can connect — the data store is not closed off to the host during a full-app run.

---

### Edge Cases

- The data store is slower to become ready than the API: the API MUST wait (retry/backoff) until the data store accepts connections rather than exiting once and leaving a permanently failed stack.
- A documented host port is already in use: start fails. The operator uses the container engine’s bind-error message (it names the port). No extra app-specific parser. Document this in the quickstart “what not to do” notes.
- Required run-time configuration is missing or invalid: start fails with a message naming the missing setting. Local testing: missing `.env` keys. NAS production: missing secrets in the NAS Docker setup. Processes MUST NOT run with an empty session secret or empty database password.
- Stored data from an older schema exists: bringing the API up applies pending structure updates; it MUST NOT wipe gardener data to “fix” the schema.
- One service fails after others are up: the operator can see which part failed; restarting the failed part does not require deleting stored data.
- The operator stops the stack with data they care about: a normal stop MUST NOT delete the data volume; destroying data is a separate, documented, explicit action.
- The operator has no other devices on the network: **local testing** at `http://127.0.0.1:8080` still works.
- A device on a different network (guest Wi-Fi, cellular, the public internet) cannot reach the NAS app unless the operator has done extra network setup; that extra setup is out of scope.
- The NAS IP changes: documentation MUST say the gardener opens the current NAS IP; this feature does not require a stable hostname or TLS.
- The operator stops UI and API on the NAS while leaving the data store up: a later UI/API start MUST reconnect to that same data store without a wipe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For **local testing**, a contributor MUST be able to start the web client, API, and data store together with a documented command that uses the project’s stack definition, **without** installing a language runtime or a database on the host. The documented web address for this mode MUST be **`http://127.0.0.1:8080`** (loopback; `WEB_PORT` may override the port only).
- **FR-003**: After a successful start in either mode, the documented web address MUST serve the packaged web client (the same class of build gardeners would receive on a self-hosted install — not a live-reload development server). “Successful start” means `GET /api/health` on that origin returns 200.
- **FR-004**: The web client served by the stack MUST reach this stack’s API on the same origin as the documented web address for that mode; the operator MUST NOT be given (or need) a second API URL for the documented run.
- **FR-005**: On first start with empty storage, the API MUST apply pending data-structure updates before serving ordinary traffic.
- **FR-006**: On first start, the stack MUST leave the app usable: documented demo accounts exist, and the plant catalog is populated enough to browse, without a separate host-side seed command.
- **FR-007**: Gardener-created data (gardens, members, plantings, reminders, layout) MUST persist across a normal stop and start of UI/API and across data-store restarts. Stopping UI/API MUST NOT wipe the data store.
- **FR-008**: Secrets MUST NOT be committed as production values. Local testing MUST read secrets from the project `.env` file (a committed example file MAY document the keys). NAS production MUST read secrets from the NAS Docker/container setup; it MUST NOT require a committed production `.env`.
- **FR-009**: If the data store is not yet accepting connections, the API MUST wait and retry until it is (or fail the start with a clear timeout), rather than crashing once and staying down.
- **FR-010**: Documentation MUST list: local-testing start (`http://127.0.0.1:8080`, `.env`), NAS production start (data store alone, then UI and API, secrets via NAS Docker setup), how to stop each, the NAS IP web address (`http://<NAS-IP>:8080`), demo accounts, the host-only web/API path (User Story 5), the host data-store address, that wiping stored data is a separate explicit action, and that a port-in-use failure is the container engine’s bind error.
- **FR-011**: The existing host workflow (data store from the stack, web and API on the host) MUST continue to work after this feature (User Story 5).
- **FR-012**: Stack configuration for both modes MUST live in the repository (constitution: self-hosted, not a cloud-vendor control panel).
- **FR-013**: The data store MUST run as its own container, separate from the web client and API (not bundled inside either app image).
- **FR-014**: The data store MUST remain reachable from the host at a documented address so a host-run API or tools can connect (including while UI/API are also running).
- **FR-015**: The operator MUST be able to start the data store without starting UI or API, and MUST be able to start or stop UI and API without stopping the data store (NAS production and local testing).
- **FR-016**: For **NAS production**, gardeners MUST reach the app at a single origin on the **NAS IP** (`http://<NAS-IP>:8080`, pages and API on that same origin) from other devices on the local network. Implement MUST prove bind `0.0.0.0` with a health check on a non-loopback address (LAN IP or equivalent), not docs-only.

### Key Entities

- **Application stack**: Web client and API as a startable unit, plus an independent data store. Local testing may start all three together. NAS production starts the data store alone and UI/API separately. Each mode has one web origin (`http://127.0.0.1:8080` vs `http://<NAS-IP>:8080`).
- **Data store service**: A standalone container that holds persisted application data. It can run alone (NAS or host web/API connect to it) or alongside stacked UI/API; it is reachable from the host.
- **Run mode**: **Local testing** (`http://127.0.0.1:8080`) vs **NAS production** (`http://<NAS-IP>:8080`). Same product; different advertised address and start grouping.
- **Operator configuration**: Run-time settings (listen addresses, data-store password, session secret, public web origin). Local testing: `.env`. NAS production: NAS Docker/container setup.
- **Persisted application data**: Gardener and catalog records that survive UI/API restart and data-store restart. Destroying this data is never implied by “stop.”

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can start **local testing** from this repository with the documented command(s) and open the app at `http://127.0.0.1:8080` without installing a database or language runtime on the host.
- **SC-002**: Within 10 minutes of `GET /api/health` returning 200 on the NAS origin (excluding first-time image download/build), a gardener on the local network can open `http://<NAS-IP>:8080` and sign in as a documented demo gardener. Implement records that elapsed time in quickstart notes.
- **SC-003**: After creating a garden, stopping and starting UI/API (data store left running) still shows that garden after sign-in in 100% of trial runs.
- **SC-004**: 9 out of 10 first-time operators following the documented NAS steps reach a signed-in home screen from another device without extra help.
- **SC-005**: A contributor can still start host web and API against the stacked data store using the existing documented commands; that path is not removed.
- **SC-006**: An operator can start the data store with no UI/API, then start UI/API later, without wiping data or restarting the data store.

## Assumptions

- **Local testing** advertises **`http://127.0.0.1:8080`** only (loopback). **NAS production** advertises a single origin at **`http://<NAS-IP>:8080`** (HTTP on the local network, not the public internet). TLS, custom domains, and orchestrators beyond the project’s stack file are out of scope.
- Former FR-002 (no host language runtime or database for stacked local testing) is part of **FR-001**.
- The data store is always its own container. On the NAS it is expected to run by itself; UI and API start and stop separately. Local testing may still start all three together for convenience. The host workflow (User Story 5) may still use separate local web and API ports as today.
- The only runtime dependency besides the web and API is the existing data store. No additional third-party services are required for a default run (plant data uses the built-in fixture source).
- First boot may take longer than later boots because images are fetched or built once; SC-002’s 10-minute bar excludes that first download, not later starts.
- Demo gardener and admin accounts and a browsable catalog on first boot match the current “after sync” experience; operators should not need a second command for that.
- Changing gardener-facing product behavior (planning, sharing, offline PWA) is out of scope except insofar as the packaged web client and API must work together when stacked.
- Automated merge-gate jobs may keep their current start path; switching CI onto this stack is not required to complete the feature.
- Inner-loop live-reload host commands for web and API remain; stacked UI/API are a packaged (non-live-reload) run.
- Local testing secrets come from `.env`. NAS production secrets come from the NAS Docker/container setup. How a given NAS brand’s UI injects those values is an operator concern; the spec only requires that they are not committed.
