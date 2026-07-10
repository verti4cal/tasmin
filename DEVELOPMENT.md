# Developing Tasmin

For what the app does and how to use it, see [README.md](README.md). This
file covers the stack, project layout, and local dev setup.

## Stack

- **Backend:** Node.js 22 + TypeScript, [Fastify](https://fastify.dev), [Drizzle ORM](https://orm.drizzle.team) over SQLite (`better-sqlite3`)
- **Frontend:** React + TypeScript + Vite + Tailwind
- **DB:** SQLite (single file, WAL mode) — no separate database process
- **Realtime:** WebSocket gateway broadcasting live device state (power, RSSI, etc.), build logs/status, scan progress, and OTA progress to every connected client, multiplexed over one connection
- **Device discovery:** devices are added by scanning a subnet (CIDR, e.g. `192.168.1.0/24`, capped at 1024 addresses) rather than entering IPs by hand — every address is probed with a short-timeout `Status 0` request, and anything that answers like a Tasmota device is added automatically, deduplicated against existing devices. Progress and discoveries stream live over WS; one scan runs at a time.
- **Device state:** devices with a configured MQTT topic get pushed updates via `mqtt.js` (subscribing to their `tele/#`/`stat/#` topics); devices without one are covered by an HTTP poller that issues `Status 11` on an interval
- **Command feedback:** sending a command (e.g. "Toggle power") logs the exact URL and payload sent and the response received, records the response into device state immediately (so the UI reflects it without waiting for the next poll/MQTT tick), and surfaces a specific error in the UI — with a 502 and the real reason — if the device doesn't respond, instead of failing silently
- **Groups:** assign devices to a group, then fan a command out to every member at once (e.g. "All Off"); one device failing doesn't block the rest
- **Rules:** read/edit/enable any of a device's three Tasmota rule slots (`Rule1`/`2`/`3`) from the UI
- **Config backup/restore:** pulls a device's full config dump (`/dl`) into SQLite as a blob, and can push a stored dump back to a device (`/u3`) — the same mechanism Tasmota's own web UI uses
- **Firmware compiler:** queue a custom Tasmota build (pick a version from the real release tags — fetched via `git ls-remote` and cached for an hour — plus PlatformIO env, `user_config_override.h` contents, and PlatformIO `build_flags`), watch the compile log stream live over WS (auto-scrolling, pauses if you scroll up), then download the binary or push it to a device. Builds and their logs persist across restarts, and a build made from a preset shows which one on the build list and OTA select. One build runs at a time. Reusable presets save a build's full config — including build_flags — under a name, and can be deleted.
- **Firmware push (pull-based OTA):** pushing a build tells the device to fetch it itself — sets its `OtaUrl` to this server's download endpoint and issues `Upgrade`, the same mechanism Tasmota's own web UI "Firmware Upgrade by URL" uses — then polls the device's actual reported firmware version (bounded retries) to confirm the flash really happened rather than trusting the HTTP response. Firmware variants with a reduced command set (e.g. `tasmota-minimal`) that don't answer `Status 2` are handled by falling back to scraping the version out of the device's own web UI footer, and as a last resort by just confirming the device is reachable again. Requires `OTA_URL_DOMAIN` to be set to an address devices on the LAN can reach this server at. Both the compiled binary and a gzip-compressed `.bin.gz` are generated for every build (compiled or downloaded prebuilt) and either can be selected for the push, or downloaded directly — useful for devices with limited flash.
- **Build flags:** a curated set of toggles for Tasmota's documented `build_flags` (from `platformio_override_sample.ini`: debug core/driver/sensor, ESP8266 heap stats, `F_CRYSTAL`, switch-warning suppression) plus a free-text field for anything else, written to `platformio_override.ini`'s `[tasmota]` section — the same additive mechanism Tasmota itself documents, applied before its own required flags so it can't break the build.
- **Prebuilt firmware:** skip compiling entirely — pick a release version and a variant (release, minimal, sensors, display, IR, ESP32 chip variants, etc.) and download the official binary straight from Tasmota's GitHub release assets (list cached per version for an hour). Downloaded firmware lands in the same list as compiled builds and is downloadable/pushable to a device identically — only the "how it was produced" differs (shown as a "prebuilt" badge).
- **Telemetry history:** every recorded state value is also appended to a time-series log (separate from the "latest value" table), queryable per key over a time window and rendered as a small inline SVG chart per device — no charting library. The log is pruned on a schedule (`TELEMETRY_RETENTION_DAYS`, default 14) so it doesn't grow unbounded.

## Project layout

```
server/                Fastify API — domain logic, DB schema/migrations, Tasmota HTTP client
web/                   React SPA
Dockerfile                 production build (single container)
docker-compose.yml         production stack
Dockerfile.dev              dev image — deps/toolchain only, source is bind-mounted
docker-compose.dev.yml      dev stack — hot reload for both server and web
Makefile                    common commands (make help)
```

Inside `server/src`:

- `domain/` — framework-agnostic business logic (devices, groups, device state + telemetry, rules, config backups, firmware build queue/presets, subnet scanning), unit-testable without Fastify — several `*.test.ts` files show the pattern
- `infra/` — SQLite client + Drizzle schema, Tasmota HTTP client + payload parsing, MQTT listener, HTTP poller, firmware `BuildRunner` (shells out to `git`/`pio`), CIDR parsing, bounded-concurrency runner
- `api/` — Fastify route modules (thin, validate input then call `domain/`)
- `ws/` — WebSocket broadcast gateway; `DeviceStateService` and `BuildQueue` both push through it (`device.state`, `build.log`, `build.status` events)

## Development

Two ways to run the app locally — pick whichever fits your workflow.

### Option A: Docker dev stack (hot reload, no local Node/PlatformIO needed)

```bash
make dev
```

Runs `docker-compose.dev.yml`: a `server` container (`tsx watch`, port 3000)
and a `web` container (Vite dev server, port 5173), both built from
`Dockerfile.dev`. Source is bind-mounted from the host, so edits on either
side hot-reload inside the containers immediately — verified for both a
backend route change (tsx restarts) and a frontend component change (Vite
HMR). `node_modules` are named volumes so the bind mount doesn't shadow the
container's installed packages with the host's (possibly wrong-platform)
ones. SQLite data, the Tasmota checkout, and PlatformIO's cache persist in
a `tasmin-dev-data` volume between runs. Stop with `make dev-down`.

### Option B: Node directly on the host

Requires Node 22+.

```bash
npm install

# one-time: create the SQLite schema
npm run db:migrate --workspace server

# run both dev servers (separate terminals)
npm run dev:server   # Fastify on :3000
npm run dev:web       # Vite on :5173, proxies /api and /ws to :3000
```

Open http://localhost:5173.

Copy `server/.env.example` to `server/.env` to override defaults (port, DB
path, log level, poll interval, MQTT broker URL). Devices without a
`mqttTopic` set are polled over HTTP on `DEVICE_POLL_INTERVAL_MS`; devices
with one are updated via MQTT instead (requires `MQTT_URL`).

The firmware compiler needs `git` and PlatformIO (`pio`) on `PATH` locally —
install PlatformIO with `pip install platformio` if you want to exercise
that feature outside Docker (or just use Option A, which bundles both).
`GIT_COMMAND`/`PIO_COMMAND` let you point at different binaries;
`TASMOTA_SRC_DIR`/`FIRMWARE_OUTPUT_DIR` control where the Tasmota checkout
and compiled binaries are cached.

Pushing firmware to a device needs `OTA_URL_DOMAIN` set to the IP or domain
(optionally with a port, e.g. `192.168.1.50:3000`) that devices on your LAN
can use to reach this server — it's baked into the URL a device is told to
pull its firmware from, so it can't be inferred from inside the container.
For the Docker dev stack, `server/.env` is enough (the repo is bind-mounted,
so it's picked up as-is). For the production stack, the image doesn't
include `.env` at all — set `OTA_URL_DOMAIN` (and any other override) under
`environment:` in `docker-compose.yml` instead. Note that env vars set there
always win over `server/.env` inside the same container: `dotenv` never
overrides a variable that's already present in the process environment.

### Common commands

All available as both `make <target>` and the underlying `npm run <script>`
— run `make help` for the full list.

- `make install` — install all workspace dependencies
- `make dev` / `make dev-down` / `make dev-logs` — the Docker dev stack above
- `make build` — production build of both workspaces
- `make test` — server-side unit tests (Vitest)
- `make lint` / `make format` — ESLint / Prettier across the whole repo
- `make migrate` — apply DB migrations locally (not via Docker)
- `make db-generate` — generate a new Drizzle migration after editing `server/src/infra/db/schema.ts`
- `make start` / `make stop` / `make restart` / `make logs` — the production Docker stack (see the README)
- `make clean` — remove `node_modules`, build output, and local SQLite data

## Docker (production build details)

```bash
make start   # equivalent to: docker compose up --build -d
```

Serves the app on http://localhost:3000 (Fastify serves the built SPA
directly, so there's a single port). SQLite data, the cached Tasmota source
checkout, compiled firmware binaries, and PlatformIO's own package cache all
persist in the `tasmin-data` named volume, mounted at `/data`.

The image bundles `git` + PlatformIO so the firmware compiler works out of
the box, which is a deliberate size tradeoff (~1GB+, and PlatformIO will
download additional toolchains per environment on first use of that
environment). If you only want device management and don't need the
compiler, skip installing those packages in a local Dockerfile fork.

## Releasing a new image

Pushing a tag matching `v*.*.*` (e.g. `v1.2.3`) triggers
[`.github/workflows/docker-release.yml`](.github/workflows/docker-release.yml),
which builds the production `Dockerfile` for `linux/amd64` and `linux/arm64`
and pushes it to GHCR as `ghcr.io/verti4cal/tasmin`, tagged `1.2.3`, `1.2`,
`1`, and `latest`.

```bash
git tag v1.2.3
git push origin v1.2.3
```

Ordinary commits/pushes to `main` don't publish anything — only a matching
tag does. The workflow can also be re-run manually from the Actions tab
(`workflow_dispatch`); pick the tag from the "Use workflow from" ref
selector to rebuild/republish an existing release.

**First release only:** GHCR packages are private by default when first
published via the repo's own `GITHUB_TOKEN`. After the first successful run,
go to the package's page (linked from the repo sidebar under "Packages") and
set its visibility to public if you want `docker pull` to work without
authenticating. Also confirm the repo's Settings → Actions → General →
"Workflow permissions" is set to "Read and write permissions" — otherwise
the push step fails with a 403/denied error.
