#!/bin/bash
# run_test_alt.sh – Startskript für ALT (rpi-ws281x) GRB LED-Tests
# Startet: tests/led_test_alt_grb.cjs

set -euo pipefail

PROJECT_DIR="/home/singer/led-sound-bachlauf"
SCRIPT="$PROJECT_DIR/tests/led_test_alt_grb.cjs"

# ===== Standard-Parameter =====
COUNT=${COUNT:-500}          # LEDs
BRIGHTNESS=${BRIGHTNESS:-255}
GPIO=${GPIO:-12}

# Verhalten / Timings
HOLD=${HOLD:-1200}           # ms Pause zw. Tests, wenn --wait=false
WIPE_MS=${WIPE_MS:-20}       # Schrittgeschwindigkeit für Lauflichter (ms)
WAIT=${WAIT:-true}          # true = nach jedem Test Enter abwarten

# Neue Optionen
FIXED10=${FIXED10:-10}       # Blockgröße für "RGB-Blöcke à 10"
SEG=${SEG:-5}                # Segmentlänge für Segment-Lauflicht
ROUNDS=${ROUNDS:-4}          # Runden für Gap-Lauflicht

# Logging
LOGFILE="${LOGFILE:-$PROJECT_DIR/ledtest_alt.log}"

echo "Projekt:   $PROJECT_DIR"
echo "Script:    $SCRIPT"
echo "Logfile:   $LOGFILE"
echo "Node:      $(command -v node) ($(node -v || true))"
echo "COUNT=$COUNT  BRIGHTNESS=$BRIGHTNESS  GPIO=$GPIO"
echo "HOLD=$HOLD  WIPE_MS=$WIPE_MS  WAIT=$WAIT"
echo "FIXED10=$FIXED10  SEG=$SEG  ROUNDS=$ROUNDS"
echo

# Existenzcheck
if [[ ! -f "$SCRIPT" ]]; then
  echo "FEHLER: Script nicht gefunden: $SCRIPT"
  exit 1
fi

cd "$PROJECT_DIR"

# ===== (optional) Core-Dumps aktivieren für native Debugs =====
ulimit -c unlimited || true
sudo sysctl -w kernel.core_pattern=/tmp/core.%e.%p.%t >/dev/null || true
sudo sysctl -w fs.suid_dumpable=1 >/dev/null || true

echo "Starte ALT-GRB-LED-Test..."
sudo -E node "$SCRIPT" \
  --count "$COUNT" \
  --brightness "$BRIGHTNESS" \
  --gpio "$GPIO" \
  --hold "$HOLD" \
  --wipe-ms "$WIPE_MS" \
  --wait "$WAIT" \
  --fixed10 "$FIXED10" \
  --seg "$SEG" \
  --rounds "$ROUNDS" \
  --logfile "$LOGFILE"

status=$?
echo "Fertig. Exit-Code: $status"
exit $status
