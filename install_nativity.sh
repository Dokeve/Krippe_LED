#!/usr/bin/env bash
# install_nativity.sh
# Bootstrap für das Krippe-Projekt im Ordner /home/singer/led-sound-bachlauf
# - legt Ordnerstruktur an
# - installiert Node + MariaDB
# - richtet DB 'nativity' (User 'pi', ohne Passwort via unix_socket) ein
# - spielt migrations/001_init.sql ein (falls vorhanden)
# - installiert npm-Pakete
# - kopiert nativity.service nach /etc/systemd/system und startet den Dienst

set -euo pipefail

APP_ROOT="/home/singer/led-sound-bachlauf"
APP_DIR="${APP_ROOT}"
AUDIO_ROOT="${APP_DIR}/audio/krippe"
SQL_DIR="${APP_DIR}/migrations"
SERVICE_SRC="${APP_DIR}/nativity.service"
SERVICE_DST="/etc/systemd/system/nativity.service"

log() { echo -e "\033[1;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33mWARN:\033[0m $*"; }

log "Ordnerstruktur anlegen"
sudo mkdir -p \
  "${APP_DIR}/public/js" \
  "${APP_DIR}/routes" \
  "${APP_DIR}/services" \
  "${APP_DIR}/data" \
  "${SQL_DIR}" \
  "${AUDIO_ROOT}/Hintergrundmusik" \
  "${AUDIO_ROOT}/Audiosprachdateien"

sudo chown -R singer:singer "${APP_ROOT}"

log "Pakete installieren (Node.js, npm, MariaDB, Build-Essentials)"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm mariadb-server build-essential git

# npm ggf. aktualisieren (falls npx fehlt)
if ! command -v npx >/dev/null 2>&1; then
  sudo npm install -g npm
fi

log "MariaDB starten & aktivieren"
sudo systemctl enable mariadb
sudo systemctl start mariadb

log "MariaDB: DB 'nativity' und User 'pi' (unix_socket) einrichten"
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS nativity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci;
CREATE USER IF NOT EXISTS 'pi'@'localhost' IDENTIFIED VIA unix_socket;
GRANT ALL PRIVILEGES ON nativity.* TO 'pi'@'localhost';
FLUSH PRIVILEGES;
SQL

log "Schema einspielen (falls migrations/001_init.sql vorhanden)"
if [[ -f "${SQL_DIR}/001_init.sql" ]]; then
  sudo -u pi mysql nativity < "${SQL_DIR}/001_init.sql"
else
  warn "${SQL_DIR}/001_init.sql nicht gefunden - Schema später einspielen."
fi

log "npm-Pakete installieren"
cd "${APP_DIR}"
npm install express mysql2 morgan rpi-ws281x onoff dayjs

log "systemd-Service installieren/aktivieren"
if [[ -f "${SERVICE_SRC}" ]]; then
  sudo cp -f "${SERVICE_SRC}" "${SERVICE_DST}"
  sudo systemctl daemon-reload
  sudo systemctl enable nativity.service
  sudo systemctl restart nativity.service
else
  warn "${SERVICE_SRC} nicht gefunden - lege die Datei im Projekt ab und starte dieses Skript erneut."
fi

log "Fertig. Service-Status:"
sudo systemctl status nativity.service --no-pager -l | sed -n '1,30p'

