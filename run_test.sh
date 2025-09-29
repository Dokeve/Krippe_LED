#!/bin/bash
# run_test.sh – LED-Test bequem starten

# Projekt- und Testpfade
PROJECT_DIR="/home/singer/led-sound-bachlauf"
SCRIPT="$PROJECT_DIR/tests/led_test_matrix.cjs"
LOGFILE="$PROJECT_DIR/ledtest.log"

# Kernel-Core-Dumps (optional, für Debugging)
ulimit -c unlimited
sudo sysctl -w kernel.core_pattern=/tmp/core.%e.%p.%t

# Testlauf starten und Log mitschreiben
cd "$PROJECT_DIR" || exit 1

echo "Starte LED-Testskript..."
echo "Log-Datei: $LOGFILE"

sudo -E MALLOC_CHECK_=3 node --trace-uncaught "$SCRIPT" \
  --count 200 \
  --brightness 255 \
  --gpio 12 \
  --lib alt \
  --strip auto \
  >> "$LOGFILE" 2>&1
