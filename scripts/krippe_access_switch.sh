#!/usr/bin/env bash
# scripts/krippe_access_switch.sh
# Switches between known WiFi networks and an Access Point using NetworkManager (nmcli).
# - If any known SSID from NM profiles is in range, try to connect to it.
# - Otherwise ensure the AP profile (KrippeAP) exists and bring it up.
# Usage:
#  sudo bash scripts/krippe_access_switch.sh        # run once (recommended from timer)
#  sudo bash scripts/krippe_access_switch.sh -a     # force AP (stop switching)
#  bash scripts/krippe_access_switch.sh -n          # dry-run / non-root (no changes)
#  bash scripts/krippe_access_switch.sh -s 192.168.50.5/24  # use specified static IP for AP

set -euo pipefail

PROG_NAME=$(basename "$0")
DRY_RUN=0
FORCE_AP=0
DEBUG=0
STATIC_ADDR="192.168.50.5/24"  # default AP IP
AP_SSID="KrippeAP"
AP_CONN_NAME="KrippeAP"
AP_PSK="Krippe2025"
IFACE="wlan0"
NMCLI=${NMCLI:-nmcli}

usage() {
  cat <<EOF
Usage: $PROG_NAME [options]
Options:
  -a        Force AccessPoint (activate AP and skip trying to connect to WiFi)
  -n        Dry-run (no changes applied)
  -s ADDR   Static IP for AP (CIDR), default ${STATIC_ADDR}
  -i IFACE  Wireless interface to use (default wlan0)
  -p PSK    AP password (default ${AP_PSK})
  -d        Debug/verbose
  -h        Show this help
EOF
}

log() { echo "[krippe-access] $*"; }
debug() { if [[ $DEBUG -eq 1 ]]; then echo "[krippe-access DEBUG] $*"; fi }
run() { if [[ $DRY_RUN -eq 1 ]]; then echo "+(dry) $*"; else echo "+ $*"; eval "$@"; fi }

while getopts ":ans:i:p:dh" opt; do
  case $opt in
    a) FORCE_AP=1 ;;
    n) DRY_RUN=1 ;;
    s) STATIC_ADDR="$OPTARG" ;;
    i) IFACE="$OPTARG" ;;
    p) AP_PSK="$OPTARG" ;;
    d) DEBUG=1 ;;
    h) usage; exit 0 ;;
    :) echo "Missing arg for -$OPTARG"; usage; exit 2 ;;
    \?) echo "Invalid option -$OPTARG"; usage; exit 2 ;;
  esac
done

# Helpers
require_nm() {
  if ! command -v "$NMCLI" >/dev/null 2>&1; then
    echo "nmcli not found. Please install NetworkManager and nmcli." >&2
    exit 3
  fi
}

known_wifi_profiles() {
  # list connection names for TYPE wifi that are not the AP profile
  $NMCLI -t -f NAME,TYPE connection show | grep ':wifi$' | cut -d: -f1 | grep -v "^${AP_CONN_NAME}$" || true
}

scan_visible_ssids() {
  # scan with nmcli (requires WiFi radio on)
  $NMCLI -t -f SSID device wifi list ifname "$IFACE" | sed '/^$/d' | sort -u || true
}

ensure_ap_profile() {
  # Create or update AP profile named ${AP_CONN_NAME}
  # The AP uses static IPv4 address STATIC_ADDR on IFACE
  log "Ensuring AP profile '${AP_CONN_NAME}' exists (SSID=${AP_SSID}, IP=${STATIC_ADDR})"
  # Create if missing
  if $NMCLI -t -f NAME connection show | grep -qx "${AP_CONN_NAME}"; then
    debug "AP connection ${AP_CONN_NAME} exists. Updating settings..."
    run $NMCLI connection modify "${AP_CONN_NAME}" 802-11-wireless.mode ap 802-11-wireless.band bg 802-11-wireless.channel 6
    run $NMCLI connection modify "${AP_CONN_NAME}" 802-11-wireless.ssid "${AP_SSID}"
    run $NMCLI connection modify "${AP_CONN_NAME}" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${AP_PSK}"
    run $NMCLI connection modify "${AP_CONN_NAME}" ipv4.method manual ipv4.addresses "${STATIC_ADDR}" ipv6.method ignore
    # Disable WiFi powersave for this profile
    run $NMCLI connection modify "${AP_CONN_NAME}" 802-11-wireless.powersave 2
  else
    debug "Creating AP connection ${AP_CONN_NAME}"
    run $NMCLI connection add type wifi ifname "${IFACE}" con-name "${AP_CONN_NAME}" autoconnect no ssid "${AP_SSID}"
    run $NMCLI connection modify "${AP_CONN_NAME}" 802-11-wireless.mode ap 802-11-wireless.band bg 802-11-wireless.channel 6
    run $NMCLI connection modify "${AP_CONN_NAME}" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${AP_PSK}"
    run $NMCLI connection modify "${AP_CONN_NAME}" ipv4.method manual ipv4.addresses "${STATIC_ADDR}" ipv6.method ignore
    run $NMCLI connection modify "${AP_CONN_NAME}" 802-11-wireless.powersave 2
  fi
}

activate_ap() {
  ensure_ap_profile
  log "Bringing up AP '${AP_CONN_NAME}' on ${IFACE}"
  # disconnect any existing wifi client on IFACE to avoid conflicts
  run $NMCLI device disconnect "$IFACE" || true
  run $NMCLI connection up "${AP_CONN_NAME}" ifname "$IFACE"
}

try_connect_known() {
  # Get visible SSIDs and known profiles. Try profiles whose SSID is visible.
  local visible
  visible=$(scan_visible_ssids)
  debug "Visible SSIDs:\n$visible"
  local profiles
  profiles=$(known_wifi_profiles)
  debug "Known wifi profiles:\n$profiles"

  # Try to match profiles by SSID (NM profile name may differ). We'll iterate profiles and check their 'ssid' value
  local p
  for p in $profiles; do
    # get profile SSID
    local prof_ssid
    prof_ssid=$($NMCLI -s -g 802-11-wireless.ssid connection show "$p" 2>/dev/null || true)
    prof_ssid=${prof_ssid:-}
    debug "Profile '$p' -> SSID='$prof_ssid'"
    if [[ -z "$prof_ssid" ]]; then
      # sometimes profile name is SSID
      prof_ssid="$p"
    fi
    # check if visible
    if echo "$visible" | grep -Fxq "$prof_ssid"; then
      log "Attempting to activate profile '$p' (SSID=$prof_ssid)"
      # try to connect
      if run $NMCLI connection up "$p" ifname "$IFACE"; then
        log "Connected with profile '$p'"
        return 0
      else
        warn "Failed to connect with profile '$p'"
      fi
    fi
  done

  return 1
}

# Start
require_nm

# If force AP, directly activate AP
if [[ $FORCE_AP -eq 1 ]]; then
  log "Force AP requested"
  activate_ap
  exit 0
fi

# Try to connect to known WiFi
log "Scanning for known WiFi networks..."
if try_connect_known; then
  log "Connected to known WiFi. Leaving as client."
  exit 0
fi

# No known network reachable -> enable AP
log "No known wifi found -> enabling AP"
activate_ap
exit 0
