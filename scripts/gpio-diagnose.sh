#!/usr/bin/env bash
# scripts/gpio-diagnose.sh
# Kurzes Diagnose-Skript für GPIO / pigpio auf dem Raspberry Pi.
# Produziert ein Logfile in diagnostics/gpio-diagnose-<timestamp>.log
# Usage: AUDIO_BUTTON_GPIO=5 PUMP_GPIO=22 PULL=UP ./scripts/gpio-diagnose.sh

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/diagnostics"
mkdir -p "$OUT_DIR"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
OUT_FILE="$OUT_DIR/gpio-diagnose-$TS.log"

# Helper to append and echo
log() {
  printf "%s %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$OUT_FILE"
}

log "Starting GPIO diagnosis"
log "Output -> $OUT_FILE"

# Load env overrides, prefer commandline env, then .env if present
AUDIO_BUTTON_GPIO=${AUDIO_BUTTON_GPIO:-}
PUMP_GPIO=${PUMP_GPIO:-}
PULL=${PULL:-}
if [ -f "$ROOT_DIR/.env" ]; then
  # crude parse: look for var=val lines
  if [ -z "$AUDIO_BUTTON_GPIO" ]; then
    val=$(grep -E '^\s*AUDIO_BUTTON_GPIO\s*=' "$ROOT_DIR/.env" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)
    [ -n "$val" ] && AUDIO_BUTTON_GPIO=$val
  fi
  if [ -z "$PUMP_GPIO" ]; then
    val=$(grep -E '^\s*PUMP_GPIO\s*=' "$ROOT_DIR/.env" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)
    [ -n "$val" ] && PUMP_GPIO=$val
  fi
  if [ -z "$PULL" ]; then
    val=$(grep -E '^\s*PULL\s*=' "$ROOT_DIR/.env" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)
    [ -n "$val" ] && PULL=$val
  fi
fi

# defaults
AUDIO_BUTTON_GPIO=${AUDIO_BUTTON_GPIO:-5}
PUMP_GPIO=${PUMP_GPIO:-22}
PULL=${PULL:-DOWN}

log "Using AUDIO_BUTTON_GPIO=$AUDIO_BUTTON_GPIO PUMP_GPIO=$PUMP_GPIO PULL=$PULL"

# 1) pigpiod status
log "--- pigpiod status ---"
if command -v systemctl >/dev/null 2>&1; then
  systemctl status pigpiod --no-pager 2>&1 | tee -a "$OUT_FILE"
else
  log "systemctl not available"
fi

# 2) pid/socket info
if [ -e /var/run/pigpio.pid ]; then
  PID=$(cat /var/run/pigpio.pid 2>/dev/null || true)
  log "/var/run/pigpio.pid exists: PID=$PID"
  if [ -n "$PID" ]; then
    ps -p "$PID" -o pid,cmd 2>&1 | tee -a "$OUT_FILE"
    if [ -d "/proc/$PID/fd" ]; then
      log "Listing /proc/$PID/fd"
      ls -l "/proc/$PID/fd" 2>&1 | tee -a "$OUT_FILE"
    fi
  fi
else
  log "/var/run/pigpio.pid not present"
fi

# show possible socket
if [ -e /var/run/pigpio.sock ]; then
  log "/var/run/pigpio.sock exists"
  ls -l /var/run/pigpio.sock 2>&1 | tee -a "$OUT_FILE"
else
  log "/var/run/pigpio.sock not present"
fi

# 3) pigs CLI checks
if command -v pigs >/dev/null 2>&1; then
  log "--- pigs tests (single reads) ---"
  log "pigs r $AUDIO_BUTTON_GPIO"
  pigs r "$AUDIO_BUTTON_GPIO" 2>&1 | tee -a "$OUT_FILE"
  log "pigs r $PUMP_GPIO"
  pigs r "$PUMP_GPIO" 2>&1 | tee -a "$OUT_FILE"

  log "--- pigs watch (5s sampling) for audio button - press the button during the test ---"
  end=$((SECONDS+5))
  while [ $SECONDS -lt $end ]; do
    v=$(pigs r "$AUDIO_BUTTON_GPIO" 2>/dev/null || echo ERR)
    printf "%s pin %s = %s\n" "$(date +%T)" "$AUDIO_BUTTON_GPIO" "$v" | tee -a "$OUT_FILE"
    sleep 0.2
  done
else
  log "pigs CLI not installed or not in PATH"
fi

# 4) sysfs checks
log "--- sysfs checks ---"
for PIN in "$AUDIO_BUTTON_GPIO" "$PUMP_GPIO"; do
  if [ -d "/sys/class/gpio/gpio$PIN" ]; then
    log "sysfs: /sys/class/gpio/gpio$PIN exists"
    ls -l "/sys/class/gpio/gpio$PIN" 2>&1 | tee -a "$OUT_FILE"
    cat "/sys/class/gpio/gpio$PIN/direction" 2>>"$OUT_FILE" || true
    cat "/sys/class/gpio/gpio$PIN/value" 2>>"$OUT_FILE" || true
    cat "/sys/class/gpio/gpio$PIN/active_low" 2>>"$OUT_FILE" || true
  else
    log "sysfs: /sys/class/gpio/gpio$PIN does not exist - attempting export (may require sudo)"
    sudo sh -c "echo $PIN > /sys/class/gpio/export" 2>&1 | tee -a "$OUT_FILE" || true
    if [ -d "/sys/class/gpio/gpio$PIN" ]; then
      log "export succeeded for gpio$PIN"
      ls -l "/sys/class/gpio/gpio$PIN" 2>&1 | tee -a "$OUT_FILE"
      cat "/sys/class/gpio/gpio$PIN/value" 2>>"$OUT_FILE" || true
      cat "/sys/class/gpio/gpio$PIN/active_low" 2>>"$OUT_FILE" || true
      # cleanup (best-effort)
      sudo sh -c "echo $PIN > /sys/class/gpio/unexport" 2>&1 | tee -a "$OUT_FILE" || true
    else
      log "export attempt failed or sysfs is not supported on this system"
    fi
  fi
done

# 5) libgpiod checks
log "--- libgpiod / gpioinfo checks ---"
if command -v gpioinfo >/dev/null 2>&1; then
  gpioinfo 2>&1 | tee -a "$OUT_FILE"
  log "gpioinfo done"
else
  log "gpioinfo not installed"
fi
if command -v gpiodetect >/dev/null 2>&1; then
  gpiodetect 2>&1 | tee -a "$OUT_FILE"
else
  log "gpiodetect not installed"
fi

log "Diagnosis complete. Collected output in $OUT_FILE"

exit 0
