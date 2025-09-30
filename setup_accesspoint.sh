#!/usr/bin/env bash
# setup_accesspoint.sh
# Erstellt einen WLAN-Access-Point auf einem Raspberry Pi (wlan0) mit SSID "KrippeSF".
# DHCP via dnsmasq, AP via hostapd, statische IP 192.168.50.1/24.
# Sicherungen aller betroffenen Dateien werden erstellt.
# Tested on Raspberry Pi OS (Bullseye/Bookworm).

set -euo pipefail

SSID_DEFAULT="KrippeSF"
PSK_DEFAULT="Krippe2025"
WIFI_COUNTRY="DE"
AP_IFACE="wlan0"
AP_ADDR="192.168.50.1"
AP_CIDR="24"
AP_NET="192.168.50.0"
AP_DHCP_START="192.168.50.10"
AP_DHCP_END="192.168.50.100"
AP_DHCP_LEASE="24h"
AP_CHANNEL="6"

# Farben für Logs
b() { printf "\033[1m%s\033[0m\n" "$*"; }
g() { printf "\033[32m%s\033[0m\n" "$*"; }
y() { printf "\033[33m%s\033[0m\n" "$*"; }
r() { printf "\033[31m%s\033[0m\n" "$*"; }

need_root() {
  if [[ $EUID -ne 0 ]]; then
    r "Bitte als root ausführen: sudo bash setup_accesspoint.sh"
    exit 1
  fi
}

backup_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local ts
    ts=$(date +"%Y%m%d-%H%M%S")
    cp -a "$f" "${f}.bak-${ts}"
    y "Backup erstellt: ${f}.bak-${ts}"
  fi
}

ensure_pkg() {
  local pkg="$1"
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    b "Installiere Paket: $pkg"
    apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg"
  else
    g "Paket vorhanden: $pkg"
  fi
}

main() {
  need_root
  b "== WLAN Access Point Setup =="

  local SSID="${1:-$SSID_DEFAULT}"
  local PSK="${2:-$PSK_DEFAULT}"

  if [[ ${#PSK} -lt 8 || ${#PSK} -gt 63 ]]; then
    r "WPA2-Passwort muss 8..63 Zeichen haben. Übergeben: '${PSK}'"
    exit 1
  fi

  b "Konfiguration:"
  echo "  SSID         : $SSID"
  echo "  WPA2-PSK     : (versteckt) Länge ${#PSK}"
  echo "  Land         : $WIFI_COUNTRY"
  echo "  Interface    : $AP_IFACE"
  echo "  AP-IP        : $AP_ADDR/$AP_CIDR"
  echo "  DHCP-Bereich : $AP_DHCP_START - $AP_DHCP_END"
  echo "  Channel      : $AP_CHANNEL"

  # Pakete
  ensure_pkg hostapd
  ensure_pkg dnsmasq
  ensure_pkg rfkill
  ensure_pkg iproute2

  # WLAN Land setzen (reg. Domain)
  b "Setze WLAN-Land auf $WIFI_COUNTRY"
  raspi-config nonint do_wifi_country "$WIFI_COUNTRY" || true
  rfkill unblock wifi || true

  # dhcpcd: statische IP für wlan0
  b "Konfiguriere statische IP für $AP_IFACE in /etc/dhcpcd.conf"
  backup_file /etc/dhcpcd.conf
  # Entferne alte KrippeSF-Blöcke
  sed -i '/^# KRIPPE_AP_START/,/^# KRIPPE_AP_END/d' /etc/dhcpcd.conf
  cat <<EOF >> /etc/dhcpcd.conf
# KRIPPE_AP_START
interface ${AP_IFACE}
static ip_address=${AP_ADDR}/${AP_CIDR}
nohook wpa_supplicant
# KRIPPE_AP_END
EOF

  # dnsmasq: DHCP-Server
  b "Konfiguriere dnsmasq (/etc/dnsmasq.d/krippe_ap.conf)"
  mkdir -p /etc/dnsmasq.d
  backup_file /etc/dnsmasq.d/krippe_ap.conf
  cat > /etc/dnsmasq.d/krippe_ap.conf <<EOF
# KRIPPE AP DHCP
interface=${AP_IFACE}
bind-interfaces
domain-needed
bogus-priv
dhcp-range=${AP_DHCP_START},${AP_DHCP_END},${AP_DHCP_LEASE}
# Optionale feste IPs/Reservierungen können hier ergänzt werden
EOF

  # hostapd: Access Point
  b "Konfiguriere hostapd (/etc/hostapd/hostapd.conf)"
  backup_file /etc/hostapd/hostapd.conf
  cat > /etc/hostapd/hostapd.conf <<EOF
# KRIPPE AP
country_code=${WIFI_COUNTRY}
interface=${AP_IFACE}
ssid=${SSID}
hw_mode=g            # 2.4GHz
channel=${AP_CHANNEL}
ieee80211n=1
wmm_enabled=1
auth_algs=1
ignore_broadcast_ssid=0

# WPA2 Personal
wpa=2
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
wpa_passphrase=${PSK}
EOF

  # hostapd Default auf unsere Datei zeigen (Bookworm nutzt /etc/default/hostapd nicht mehr zwingend)
  if [[ -f /etc/default/hostapd ]]; then
    backup_file /etc/default/hostapd
    sed -i 's|^#\?DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd || true
  fi

  # wpa_supplicant auf wlan0 deaktivieren (AP-Modus)
  b "Deaktiviere wpa_supplicant für ${AP_IFACE}"
  # Maskiere die Instanz für wlan0
  mkdir -p /etc/systemd/system/wpa_supplicant@${AP_IFACE}.service.d
  cat > /etc/systemd/system/wpa_supplicant@${AP_IFACE}.service.d/override.conf <<'EOF'
[Unit]
# Verhindert, dass wpa_supplicant die AP-Schnittstelle übernimmt
ConditionPathExists=/nonexistent
EOF
  systemctl daemon-reload || true
  systemctl stop wpa_supplicant@${AP_IFACE}.service || true
  systemctl disable wpa_supplicant@${AP_IFACE}.service || true

  # NetworkManager (falls installiert) ignoriert wlan0
  if systemctl is-enabled NetworkManager >/dev/null 2>&1; then
    y "NetworkManager erkannt – füge unmanaged device hinzu (wlan0)."
    mkdir -p /etc/NetworkManager/conf.d
    cat > /etc/NetworkManager/conf.d/unmanaged.conf <<'EOF'
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF
    systemctl restart NetworkManager || true
  fi

  # Dienste aktivieren
  b "Aktiviere und starte Dienste: dhcpcd, dnsmasq, hostapd"
  systemctl unmask hostapd || true
  systemctl enable dhcpcd
  systemctl enable dnsmasq
  systemctl enable hostapd
  systemctl restart dhcpcd
  systemctl restart dnsmasq
  systemctl restart hostapd

  # Kurzer Status
  sleep 2
  b "Statuskurzprüfung:"
  systemctl --no-pager --full status hostapd | sed -n '1,15p' || true
  ip addr show dev "${AP_IFACE}" || true

  g "Fertig. Verbinde dich mit dem WLAN '${SSID}' (Passwort: '${PSK}')."
  g "Rufe dann dein System unter: http://${AP_ADDR}:8080 auf."
}

main "$@"
