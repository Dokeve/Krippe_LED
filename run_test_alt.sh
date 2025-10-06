#!/bin/bash
# run_test_ws281x.sh – Startskript für WS281x-GRB LED-Tests
# Startet: tests/led_test_alt_grb.cjs

set -euo pipefail

PROJECT_DIR="/home/singer/led-sound-bachlauf"
SCRIPT="$PROJECT_DIR/tests/led_test_alt_grb.cjs"

# ===== Standard-Parameter =====
COUNT=${COUNT:-1000}
BRIGHTNESS=${BRIGHTNESS:-255}
GPIO=${GPIO:-12}

# Verhalten / Timings
HOLD=${HOLD:-1200}
WIPE_MS=${WIPE_MS:-20}
WAIT=${WAIT:-true}

# Weitere Optionen
FIXED10=${FIXED10:-10}
SEG=${SEG:-5}
ROUNDS=${ROUNDS:-4}

# Logging
LOGFILE="${LOGFILE:-$PROJECT_DIR/ledtest_ws281x.log}"

echo "Projekt:   $PROJECT_DIR"
echo "Script:    $SCRIPT"
echo "Logfile:   $LOGFILE"
echo "Node:      $(command -v node) ($(node -v || true))"
echo "COUNT=$COUNT  BRIGHTNESS=$BRIGHTNESS  GPIO=$GPIO"
echo "HOLD=$HOLD  WIPE_MS=$WIPE_MS  WAIT=$WAIT"
echo "FIXED10=$FIXED10  SEG=$SEG  ROUNDS=$ROUNDS"
echo

if [[ ! -f "$SCRIPT" ]]; then
  echo "FEHLER: Script nicht gefunden: $SCRIPT"
  exit 1
fi

cd "$PROJECT_DIR"

ulimit -c unlimited || true
sudo sysctl -w kernel.core_pattern=/tmp/core.%e.%p.%t >/dev/null || true
sudo sysctl -w fs.suid_dumpable=1 >/dev/null || true

echo "Starte WS281x-GRB-LED-Test..."
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
