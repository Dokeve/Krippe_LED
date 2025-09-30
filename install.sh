#!/usr/bin/env bash
# install.sh  (LF-Zeilenenden!)
set -e
cd "$(dirname "$0")"

echo "[install] apt-get update…"
sudo apt-get update -y

echo "[install] System-Abhängigkeiten…"
sudo apt-get install -y build-essential gcc g++ make python3 git curl ca-certificates \
  mariadb-server mariadb-client mpg123

echo "[install] Node-Abhängigkeiten…"
sudo npm install --unsafe-perm

echo "[install] Audio-Verzeichnisse…"
mkdir -p /home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien
mkdir -p /home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik

echo "[install] Fertig."
