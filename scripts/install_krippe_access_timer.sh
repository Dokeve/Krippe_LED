#!/usr/bin/env bash
# scripts/install_krippe_access_timer.sh
# Installs systemd service + timer to run krippe_access_switch.sh every 2 minutes
# Run with sudo to install: sudo bash scripts/install_krippe_access_timer.sh install

set -euo pipefail
PROG_DIR=$(cd "$(dirname "$0")" && pwd)
SCRIPT=${PROG_DIR}/krippe_access_switch.sh
SERVICE_NAME=krippe-access
SERVICE_FILE=/etc/systemd/system/${SERVICE_NAME}.service
TIMER_FILE=/etc/systemd/system/${SERVICE_NAME}.timer

usage() {
  echo "Usage: $0 install|uninstall|status"
}

if [[ $# -lt 1 ]]; then usage; exit 1; fi

case $1 in
  install)
    echo "Installing systemd service and timer..."
    cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Krippe Access Switch Service
After=network.target

[Service]
Type=oneshot
ExecStart=${SCRIPT}
User=root
EOF
    cat > "${TIMER_FILE}" <<EOF
[Unit]
Description=Run Krippe Access Switch every 2 minutes

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF
    chmod 644 "${SERVICE_FILE}" "${TIMER_FILE}"
    systemctl daemon-reload
    systemctl enable --now ${SERVICE_NAME}.timer
    echo "Installed and started ${SERVICE_NAME}.timer"
    ;;
  uninstall)
    echo "Uninstalling..."
    systemctl disable --now ${SERVICE_NAME}.timer || true
    rm -f "${SERVICE_FILE}" "${TIMER_FILE}"
    systemctl daemon-reload
    echo "Uninstalled"
    ;;
  status)
    systemctl status ${SERVICE_NAME}.timer ${SERVICE_NAME}.service --no-pager || true
    ;;
  *) usage; exit 2 ;;
esac
