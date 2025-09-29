#!/usr/bin/env bash
# setup_nm_accesspoint.sh
# Richtet einen WLAN-Access-Point via NetworkManager (nmcli) ein.
# SSID: Krippe-AP | PSK: Krippe2025 | IFACE: wlan0 | IP: 10.0.0.5/24
# Letzte Änderung: 30.08.2025 19.15 Uhr

set -euo pipefail

SSID="Krippe-AP"
PASSPHRASE="Krippe2025"          # >= 8 Zeichen
IFACE="wlan0"
CON_NAME="KrippeAP"
AP_IP="10.0.0.5/24"
GW_IP="10.0.0.5"                 # Gateway/DNS-Ansage für Clients (nur für lokale Dienste relevant)
DNS_SERVERS="8.8.8.8,1.1.1.1"    # werden an Clients verteilt

# Vorabchecks
command -v nmcli >/dev/null || { echo "❌ nmcli (NetworkManager) nicht gefunden."; exit 1; }
systemctl is-active --quiet NetworkManager || { echo "❌ NetworkManager nicht aktiv."; exit 1; }
if [[ ${#PASSPHRASE} -lt 8 || ${#PASSPHRASE} -gt 63 ]]; then
  echo "❌ WPA2-Passwortlänge ungültig (8..63). Aktuell: ${#PASSPHRASE}"; exit 1;
fi
ip link show "$IFACE" >/dev/null 2>&1 || { echo "❌ Interface $IFACE existiert nicht."; exit 1; }

echo "▶ Unblock RFKill & set country…"
sudo rfkill unblock all || true
# Optional: Ländercode setzen (hilft bei manchen Chipsätzen)
sudo iw reg set DE || true

echo "▶ Stoppe evtl. kollidierende Dienste (hostapd/dnsmasq)…"
sudo systemctl stop hostapd 2>/dev/null || true
sudo systemctl disable hostapd 2>/dev/null || true
sudo systemctl stop dnsmasq 2>/dev/null || true
sudo systemctl disable dnsmasq 2>/dev/null || true

# Bestehende Verbindung anlegen oder ändern
if nmcli -t -f NAME con show | grep -Fxq "$CON_NAME"; then
  echo "▶ Aktualisiere bestehendes NM-Profil: $CON_NAME"
else
  echo "▶ Erzeuge NM-Profil: $CON_NAME"
  sudo nmcli con add type wifi ifname "$IFACE" con-name "$CON_NAME" autoconnect yes ssid "$SSID"
fi

echo "▶ Setze AP-Parameter…"
sudo nmcli con modify "$CON_NAME" \
  802-11-wireless.mode ap \
  802-11-wireless.band bg \
  802-11-wireless.ssid "$SSID" \
  wifi-sec.key-mgmt wpa-psk \
  wifi-sec.psk "$PASSPHRASE" \
  ipv4.method manual \
  ipv4.addresses "$AP_IP" \
  ipv4.gateway "$GW_IP" \
  ipv4.dns "$DNS_SERVERS" \
  ipv6.method ignore \
  connection.autoconnect yes

# Hinweis: Wenn Internet-Sharing via NM gewünscht ist, stattdessen:
# sudo nmcli con modify "$CON_NAME" ipv4.method shared
# (Dann wählt NM üblicherweise 10.42.0.1/24 und NAT/DHCP automatisch. Feste 10.0.0.5 ist mit "shared" nicht garantiert.)

echo "▶ Trenne evtl. aktive Verbindung auf $IFACE und starte AP…"
sudo nmcli dev disconnect "$IFACE" 2>/dev/null || true
sleep 1
sudo nmcli con up "$CON_NAME"

echo "✔ Access Point aktiv."
echo "   SSID:        $SSID"
echo "   Passwort:    $PASSPHRASE"
echo "   Interface:   $IFACE"
echo "   IP (AP):     $AP_IP"
echo "   Web-GUI:     http://10.0.0.5:8080"

echo
echo "Statuskurzcheck:"
nmcli dev status | sed 's/^/  /'
ip -4 addr show "$IFACE" | sed 's/^/  /'
