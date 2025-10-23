#!/usr/bin/env bash
set -euo pipefail

UNIT_SRC="$(dirname "$0")/../systemd/nativity.service"
UNIT_DST="/etc/systemd/system/nativity.service"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte mit sudo ausführen." >&2
  exit 1
fi

# Alt-Units deaktivieren und entfernen (sofern vorhanden)
systemctl disable --now led-sound-bachlauf.service 2>/dev/null || true
systemctl disable --now ledsound.service 2>/dev/null || true
rm -f /etc/systemd/system/led-sound-bachlauf.service /etc/systemd/system/ledsound.service || true

install -Dm644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable --now nativity.service
systemctl status nativity.service -n 50
