# Copilot instructions for Krippe_LED

This file gives precise, repo-specific guidance so an AI coding agent can be productive immediately.

Overview
- Purpose: web UI + Node service (`nativity`) to control LED groups, audio playback and scheduled scenarios on a Raspberry Pi.
- Runtime: Node (ESM, `type: module`) — see `package.json` (Node >= 20). Server entry: `server.js`.

Architecture & important boundaries
- HTTP/API: Express routes live in `routes/` (e.g. `routes/audio.js`, `routes/led-groups.js`, `routes/calendar.js`). Use these for integration points.
- Application modules: `services/` contains hardware and domain logic (e.g. `services/gpio.js`, `services/led-controll.js`, `services/lagerfeuer.js`, `services/scheduler.js`). Prefer changing behaviour here.
- Persistence: file-based JSON in `data/` (e.g. `data/led-groups.json`, `data/calendar.json`) is the current Source of Truth. Migrations live in `migrations/` and `scripts/seed.js` can help bootstrap.
- Hardware interface: `pigpio` native binding + `pigpiod` daemon is the primary GPIO strategy. `services/gpio.js` implements robust startup with socket/pid checks and a `pigs` CLI fallback. Do NOT assume direct sysfs access.
- System services: systemd drop-ins and units are under `systemd/` and deployed to `/etc/systemd/system` on Pi. Key files: `systemd/nativity.unit.dropin`, `systemd/pigpiod.permissions.conf`, and the optional forwarder `systemd/pigpiod-ipv4-forward.service`.

Developer workflows & commands (Pi)
- Install & run: `cp .env.example .env` then `npm ci --omit=dev` and `npm start` (or `systemctl start nativity`).
- Deploy systemd drop-ins: edit files under `systemd/`, then on the Pi copy unit files to `/etc/systemd/system/`, run `sudo systemctl daemon-reload`, and `sudo systemctl restart nativity`.
- Logs & diagnostics: use `sudo journalctl -u nativity -n 200 --no-pager` and `sudo journalctl -u pigpiod --no-pager`.
- Network/GPIO checks: `sudo ss -ltnp | grep 8888` to see pigpiod listeners; `ls -l /dev/pig* /dev/gpiomem` to check device ownership; `pigs` CLI for single-pin actions.
- GPIO diagnostic script: `scripts/gpio-diagnose.sh` captures common checks—use it when debugging hardware issues.

Project-specific patterns & conventions
- ESM modules throughout (`type: module` in `package.json`). Use dynamic imports only where necessary (e.g. `services/gpio.js` uses a dynamic import of `pigpio` to allow configuring `PIGPIO_ADDR` before the native binding initialises).
- File-store pattern: services read/write JSON in `data/`. When changing APIs, update both `routes/` handlers and the file schema in `data/`.
- Service ownership: historically `nativity` runs as `root` on the Pi to access GPIO devices; check `systemd/nativity.unit.dropin` before changing `User=`.
- Fallbacks: hardware code provides fallbacks (e.g. `pigs` CLI) — prefer to preserve these when changing `services/gpio.js`.

Key env vars & config files
- `.env` (project root) and `.env.example` contain GPIO init settings like `PIGPIO_SOCKET_PATH`, `PIGPIO_PID_PATH`, `PIGPIO_SOCKET_WAIT_ATTEMPTS`, and `PIGPIO_SOCKET_WAIT_DELAY_MS`.
- `systemd/nativity.unit.dropin` may provide `Environment=PIGPIO_ADDR` and `PIGPIO_PORT` for forcing TCP client mode.

Integration points & external dependencies
- pigpiod (system package) — the preferred GPIO daemon. Node `pigpio` (native binding) is in `package.json` and may require native toolchain to build.
- rpi-ws281x for LED control; audio playback uses `play-sound` and `aplay`/`mpg123` on the Pi.
- MariaDB is referenced but the repo currently uses file-based JSON stores; migrations in `migrations/` contain SQL to create DB schema when/if DB mode is used.

What to look for when editing code
- When modifying GPIO code, maintain the startup wait semantics: `services/gpio.js` waits for `/var/run/pigpio.sock` or `/var/run/pigpio.pid` before attempting initialisation and retries on failure.
- If you add native imports (e.g. `pigpio`), prefer lazy/dynamic import patterns so environment variables are set before the binding initialises.
- Route changes must update both `routes/` and any client-side code under `public/js/` that calls the API.

Examples (useful file references)
- Entry point: `server.js` — how the Express app is created and `services/` are initialised.
- Hardware startup pattern: `services/gpio.js` (socket/pid wait, dynamic import, `pigs` fallback).
- Systemd drop-ins: `systemd/nativity.unit.dropin`, `systemd/pigpiod.permissions.conf` (device permission fixups), `systemd/pigpiod-ipv4-forward.service` (socat forwarder example).
- Diagnostics & docs: `docs/GPIO.md`, `scripts/gpio-diagnose.sh`, and `diagnostics/` logs.

Concise agent rules
- Preserve file-store schema when changing APIs; add a migration in `migrations/` if you change persisted shape.
- For GPIO changes, keep fallback behavior and systemd interplay intact; prefer changing `systemd` units (drop-ins) on the Pi rather than hardcoding device permission changes in code.
- Use `npm ci --omit=dev` for clean installs; tests are not present — document test steps if you add tests.

If anything here is unclear or missing, tell me which area (systemd, GPIO, persistence, frontend) and I'll expand the instructions with concrete examples or additional commands.
