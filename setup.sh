#!/usr/bin/env bash
# setup.sh  (LF-Zeilenenden!)
# Legt einen systemd-Dienst an, damit die App beim Boot startet.
set -e
cd "$(dirname "$0")"

SERVICE_NAME="led-sound-bachlauf"
APP_DIR="$(pwd)"
NODE_BIN="$(command -v node)"

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "[setup] Schreibe ${SERVICE_FILE}…"
sudo bash -c "cat > '${SERVICE_FILE}'" <<EOF
[Unit]
Description=LED Sound Bachlauf
After=network.target mariadb.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} server.js
Restart=always
User=pi
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "[setup] systemd reload + enable + start…"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager
