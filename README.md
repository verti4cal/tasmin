# Tasmin

Tasmin is a self-hosted dashboard for managing Tasmota smart-home devices on
your own network. It combines everyday device management — control,
grouping, backups, rules, live status — with a built-in Tasmota firmware
compiler and updater, so you don't need a separate toolchain to flash custom
or official builds.

There's no login screen and no user accounts. Tasmin is meant to run on your
home network (or behind your own VPN), not on the open internet — see
[Security](#security) below.

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [How to: add devices](#how-to-add-devices)
- [How to: control a device](#how-to-control-a-device)
- [How to: group devices for bulk control](#how-to-group-devices-for-bulk-control)
- [How to: edit a device's rules](#how-to-edit-a-devices-rules)
- [How to: back up and restore a device's config](#how-to-back-up-and-restore-a-devices-config)
- [How to: view a device's history](#how-to-view-a-devices-history)
- [How to: build custom firmware](#how-to-build-custom-firmware)
- [How to: download official firmware without compiling](#how-to-download-official-firmware-without-compiling)
- [How to: save and reuse a build configuration (presets)](#how-to-save-and-reuse-a-build-configuration-presets)
- [How to: update a device's firmware (OTA)](#how-to-update-a-devices-firmware-ota)
- [Managing the app](#managing-the-app)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [For developers](#for-developers)

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) and `make` (or just
run the underlying `docker compose` commands directly).

```bash
git clone <this repo>
cd tasmin
cp server/.env.example server/.env   # then edit it — see Configuration below
make start                           # equivalent to: docker compose up --build -d
```

Open **http://localhost:3000**. That's it — the container serves both the
web UI and the API on one port.

Prefer not to build locally? Every tagged release is published to
`ghcr.io/verti4cal/tasmin` (see [DEVELOPMENT.md](DEVELOPMENT.md#releasing-a-new-image)).
Save this as `docker-compose.yaml` and run `docker compose up -d` — no clone
needed:

```yaml
services:
  tasmin:
    image: ghcr.io/verti4cal/tasmin:latest
    ports:
      - "3000:3000"
    environment:
      LOG_LEVEL: info
      DEVICE_POLL_INTERVAL_MS: 30000
      # Required to push firmware to devices — see Configuration below.
      # OTA_URL_DOMAIN: 192.168.1.50:3000
    volumes:
      - tasmin-data:/data
    restart: unless-stopped

volumes:
  tasmin-data:
```

Pin a specific version instead of always tracking `latest` by using an image
tag like `ghcr.io/verti4cal/tasmin:1.2.3` (see [Configuration](#configuration)
for what else is worth setting in `environment:`).

Your data (devices, groups, backups, firmware builds, the cached Tasmota
source) lives in a Docker volume (`tasmin-data`), so it survives restarts and
rebuilds. Nothing is deleted unless you explicitly remove that volume.

## Configuration

Copy `server/.env.example` to `server/.env` and edit it before your first
`make start`. The important settings:

| Variable | What it's for |
|---|---|
| `OTA_URL_DOMAIN` | **Set this if you plan to push firmware to devices.** The IP or hostname (optionally with a port, e.g. `192.168.1.50:3000`) that your Tasmota devices can use to reach this server. See [How to: update a device's firmware](#how-to-update-a-devices-firmware-ota). |
| `MQTT_URL` | Optional. If you run an MQTT broker and give a device an MQTT topic, Tasmin gets instant state updates over MQTT instead of polling it over HTTP. |
| `DEVICE_POLL_INTERVAL_MS` | How often (in milliseconds) devices *without* an MQTT topic are polled over HTTP. Default 30 seconds. |
| `TELEMETRY_RETENTION_DAYS` | How many days of history charts keep. Default 14. |
| `PORT` | The port the app listens on. Default 3000. |

Everything else in `.env.example` (log level, DB path, firmware compiler
paths) has a sensible default — leave it alone unless you know you need it.

**One gotcha:** if you set an environment variable directly in
`docker-compose.yml` under `environment:`, it always wins over the same
variable in `server/.env` — `.env` values are only used to fill in variables
that aren't already set.

## How to: add devices

Open the **Devices** tab.

1. Enter your network's subnet in CIDR form (e.g. `192.168.1.0/24`) in the
   "Scan for devices" box and click **Scan**.
2. Tasmin probes every address in that range for a Tasmota device and adds
   anything that responds — you'll see live progress and each device as it's
   found.
3. Already-added devices are skipped automatically, so it's safe to re-scan
   the same subnet later to pick up new devices.

There's no manual "add device by IP" form — scanning is the only way in, by
design, so you never have to type in IP addresses by hand.

## How to: control a device

In the **Devices** tab, each device shows its current power state and WiFi
signal strength (updated live — instantly if it has an MQTT topic
configured, otherwise on the polling interval). Click **Toggle power** to
turn it on/off. If a command fails (device offline, wrong host, etc.) you'll
see the specific error instead of a silent failure.

Click **Details** on a device to expand its rules editor, config
backup/restore, and history chart (see the sections below).

To move a device into a group, use the group dropdown next to it.

## How to: group devices for bulk control

Open the **Groups** tab.

1. Type a name and click **Add group**.
2. Go back to the **Devices** tab and assign devices to the group using the
   dropdown next to each one.
3. Back in **Groups**, use **All On** / **All Off** to send a command to
   every device in the group at once. If one device fails, the rest still
   get the command — you'll see which ones (if any) failed.

## How to: edit a device's rules

Open a device's **Details** panel (Devices tab → click **Details**). The
**Rules** panel lets you view and edit any of Tasmota's three rule slots
(`Rule1`/`Rule2`/`Rule3`):

1. Pick a rule slot from the dropdown.
2. Edit the rule text.
3. Click **Save rule**, and use the **Enabled** checkbox to turn that rule
   slot on/off.

## How to: back up and restore a device's config

In a device's **Details** panel, use the **Config backups** panel:

- **Create backup** pulls the device's full configuration (the same dump
  Tasmota's own "Backup Configuration" produces) and stores it.
- Each saved backup can be **Download**ed as a file, **Restore**d straight
  back to the device, or **Delete**d.

The device reboots after a restore, same as it would from Tasmota's own web
UI.

## How to: view a device's history

In a device's **Details** panel, the **History** chart shows the last 24
hours for any recorded value (power state, temperature, RSSI, etc. —
whatever that device reports). Pick which value to chart from the dropdown.
Older history is pruned automatically after `TELEMETRY_RETENTION_DAYS` days.

## How to: build custom firmware

Open the **Firmware** tab and expand **New firmware build**.

1. Pick a **Tasmota version** (real release tags, kept up to date
   automatically) and a **PlatformIO environment** (e.g. `tasmota`,
   `tasmota-sensors`, `tasmota-minimal`, ...).
2. Optionally paste `user_config_override.h` contents (e.g. your WiFi
   credentials, MQTT broker, or any `#define` override) into the text box.
3. Optionally check any of the curated **build_flags** toggles (debug
   output, ESP8266 heap stats, crystal frequency, etc.), or add your own
   flags in the free-text field.
4. Click **Queue build**.

You'll see the compile log stream in live as it happens. When it succeeds,
the build appears in the list below with **Download binary** (and
**Download .gz**, a smaller compressed version useful for devices with
limited flash storage) and a **Push to device** control — see
[How to: update a device's firmware](#how-to-update-a-devices-firmware-ota).

Only one build runs at a time; queue as many as you like and they'll run in
order. Builds and their logs are kept even after a restart.

## How to: download official firmware without compiling

If you don't need custom `build_flags` or a `user_config_override.h`, you
can skip compiling entirely. In the **Firmware** tab, expand **Download
prebuilt firmware**, pick a release version and a variant (`release`,
`minimal`, `sensors`, `display`, `ir`, various ESP32 chip targets, etc.),
and click **Download**. The official binary is fetched straight from
Tasmota's GitHub releases and shows up in the build list marked "prebuilt" —
from there it behaves exactly like a compiled build (download or push it to
a device).

## How to: save and reuse a build configuration (presets)

After filling in a build's version/environment/overrides/flags, give it a
name in the **Preset name** field and click **Save as preset**. Next time,
pick it from the **Load preset** dropdown to instantly refill the form —
handy if you regularly build the same configuration for multiple devices.
Delete a preset with **Delete preset**. Any build made from a preset shows
which one on the build list and in the OTA firmware picker.

## How to: update a device's firmware (OTA)

Tasmin pushes firmware the same way Tasmota's own web UI's "Firmware Upgrade
by URL" does: it tells the device to download the file from Tasmin itself,
then confirms the update actually took effect by checking the device's
reported version afterwards (rather than just trusting the initial
response) — so **`OTA_URL_DOMAIN` must be set** (see
[Configuration](#configuration)) to an address your devices can actually
reach this server at.

**Push a single build to one device** — in the **Firmware** tab, on any
successful build, pick a device from the dropdown, optionally check
**compressed** to send the smaller `.bin.gz` (recommended for low-storage
devices), and click **Push**.

**Update several devices at once** — open the **OTA** tab:

1. Pick the firmware to push from the dropdown (shows the source and preset
   name, if any).
2. Optionally check **Upload compressed (.bin.gz)**.
3. Select the devices to update (or check the header box to select all).
4. Click **Start update**.

You'll see each device's status live: pushing → verifying → success/failed.
A push can take up to a minute per device, since it waits for the device to
reboot and confirms the new version before declaring success. If a specific
firmware variant doesn't report its version at all (some minimal/stripped
builds don't), Tasmin falls back to scraping it from the device's own web
page, and as a last resort just confirms the device came back online.

## Managing the app

All available as `make <target>`:

- `make start` / `make stop` / `make restart` — the Docker production stack
- `make logs` — tail the running container's logs
- `make clean` — remove local build artifacts (does **not** touch your
  Docker data volume)

To fully reset all app data (devices, builds, backups, everything), remove
the `tasmin-data` Docker volume — this is destructive and cannot be undone:

```bash
docker compose down
docker volume rm tasmin_tasmin-data   # confirm the exact name with: docker volume ls
```

## Troubleshooting

**Pushing firmware fails immediately with an error about `OTA_URL_DOMAIN`.**
It isn't set. Add it to `server/.env` (or `docker-compose.yml`'s
`environment:` block) — see [Configuration](#configuration).

**A device stays stuck on "pushing"/"verifying" and then fails.** Confirm
the device can actually reach this server at whatever address you put in
`OTA_URL_DOMAIN` (same network/VLAN, no firewall blocking it) — the device
needs to download the firmware from that address itself.

**A device I know is a Tasmota device doesn't show up after a scan.** Make
sure the CIDR range actually covers its IP, and that nothing (VLAN
isolation, client isolation on the WiFi AP) is blocking HTTP traffic between
this server and the device.

**The firmware compiler is slow the first time you use a given
environment.** PlatformIO downloads the toolchain for that environment on
first use and caches it afterwards — expect the first build of, say,
`tasmota32` to take noticeably longer than the next one.

## Security

There is no authentication. Anyone who can reach the app can control every
device, read/restore backups, and push firmware. **Do not expose this app
directly to the internet.** Run it on a trusted LAN, or put it behind a
VPN/reverse-proxy with its own access control (e.g. Tailscale, or Caddy with
basic auth) if you need remote access.

## For developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for the stack, project layout, local
dev setup (hot-reloading Docker stack or running Node directly), and test/
lint commands.
