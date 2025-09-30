#!/usr/bin/env bash
set -euo pipefail

SSID="KrippeSF"
PASSPHRASE="Krippe2025"
AP_IP_CIDR="192.168.4.1/24"
DHCP_RANGE_START="192.168.4.10"
DHCP_RANGE_END="192.168.4.50"
CHANNEL="6"          # 1, 6 oder 11 sind in der Regel am stabilsten
COUNTRY="DE"         # Kritisch: verhindert Verbindungsprobleme wegen Regulatory-Domain
IFACE="wlan0"

echo "==> Validierung"
[[ ${#PASSPHRASE} -ge 8 && ${#PASSPHRASE} -le 63 ]] || { echo "Passphrase-Länge ungültig (8–63)."; exit 1; }

echo "==> Pakete installieren"
apt-get update -y
apt-get install -y hostapd dnsmasq rfkill
systemctl stop hostapd || true
systemctl stop dnsmasq || true

echo "==> Regulatory Domain setzen"
if ! grep -q "^country=${COUNTRY}$" /etc/wpa_supplicant/wpa_supplicant.conf 2>/dev/null; then
  cp -a /etc/wpa_supplicant/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf.bak.$(date +%s) || true
  sed -i "/^ctrl_interface/ i country=${COUNTRY}" /etc/wpa_supplicant/wpa_supplicant.conf 2>/dev/null || echo "country=${COUNTRY}" >> /etc/wpa_supplicant/wpa_supplicant.conf
fi
rfkill unblock wifi || true

echo "==> Feste IP für ${IFACE} via dhcpcd"
if ! grep -q "^interface ${IFACE}$" /etc/dhcpcd.conf 2>/dev/null; then
  cp -a /etc/dhcpcd.conf /etc/dhcpcd.conf.bak.$(date +%s)
  cat >> /etc/dhcpcd.conf <<EOF

# --- Access Point config ---
interface ${IFACE}
    static ip_address=${AP_IP_CIDR}
    nohook wpa_supplicant
# --- end ---
EOF
fi
service dhcpcd restart

echo "==> dnsmasq konfigurieren"
if [ -f /etc/dnsmasq.conf ]; then
  cp -a /etc/dnsmasq.conf /etc/dnsmasq.conf.orig.$(date +%s)
fi
cat > /etc/dnsmasq.conf <<EOF
interface=${IFACE}
bind-interfaces
domain-needed
bogus-priv
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
EOF

echo "==> hostapd konfigurieren"
mkdir -p /etc/hostapd
cat > /etc/hostapd/hostapd.conf <<EOF
interface=${IFACE}
driver=nl80211
ssid=${SSID}
country_code=${COUNTRY}
hw_mode=g
channel=${CHANNEL}
ieee80211d=1
ieee80211n=1
wmm_enabled=1

auth_algs=1
ignore_broadcast_ssid=0

wpa=2
wpa_passphrase=${PASSPHRASE}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF

# hostapd auf die Config zeigen lassen
if [ -f /etc/default/hostapd ]; then
  cp -a /etc/default/hostapd /etc/default/hostapd.bak.$(date +%s)
fi
sed -i 's|^#\?DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

echo "==> Dienste aktivieren/ starten"
systemctl unmask hostapd || true
systemctl enable hostapd
systemctl enable dnsmasq
systemctl restart hostapd
systemctl restart dnsmasq

echo "==> Sanity Checks"
ip -4 addr show ${IFACE} | grep -q "192.168.4.1" && echo "IP OK" || { echo "WARN: ${IFACE} hat nicht 192.168.4.1"; }
systemctl --no-pager --full status hostapd | tail -n 20 || true
systemctl --no-pager --full status dnsmasq | tail -n 20 || true

echo "==> Done."
echo "WLAN-SSID: ${SSID}"
echo "Passwort : ${PASSPHRASE}"
echo "Subnetz  : 192.168.4.0/24 (DHCP ${DHCP_RANGE_START}–${DHCP_RANGE_END})"
echo "Hinweis  : Für Internet via Ethernet ist NAT optional nachrüstbar."
