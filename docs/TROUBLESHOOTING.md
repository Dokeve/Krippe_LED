# TROUBLESHOOTING

- **ESM/CJS:** `type:"module"` setzen oder `.mjs` verwenden; CJS als `.cjs`.
- **Rechte:** Dienstuser `pi` braucht Leserechte auf Audio-Ordnern.
- **Audio-Picker:** serverseitige Whitelist + `readdir`; Frontend Filter `*.mp3, *.wav`.
- **Formulare:** localStorage-Puffer + klare 2xx/4xx-Serverantworten.

## GPIO / pigpiod Probleme und Workarounds

- Symptom: `gpioInitialise` schlägt fehl beim Serverstart (Logs enthalten pigpio Fehler und Hinweise auf /var/run/pigpio.pid oder Socket).
	- Ursache: stale PID/Socket oder pigpiod startet nicht rechtzeitig beim Systemstart.
	- Kurz‑Checks auf dem Pi:
		- `ps aux | grep pigpiod` — läuft der Daemon?
		- `ls -l /var/run/pigpio.*` — existieren alte PID/Socket Dateien?
	- Kurze Lösung (manuell):
		```bash
		sudo systemctl stop pigpiod || true
		sudo rm -f /var/run/pigpio.pid /var/run/pigpio.socket
		sudo pigpiod
		```

- Fallback: Falls pigpiod nicht verfügbar ist, die Implementation nutzt die CLI `pigs` für einzelne Pin‑Writes (wenn `pigs` im PATH). Prüfe:
	- `which pigs`
	- `pigs w <pin> <value>` (schreibt) und `pigs r <pin>` (liest).

## Logging‑Hinweise (Beispiele)
- Wenn pigpiod fehlt, erscheinen wiederholte Log‑Zeilen wie:
	- `[GPIO] gpioInitialise fehlgeschlagen (attempt 1/5): pigpio error -1 in gpioInitialise` — indicates retry logic in `services/gpio.js`.
- Bei Fallback per `pigs` werden Exitcodes und stdout/stderr geloggt; prüfe die Serverlogs (journalctl -u nativity) für konkrete Befehlsfehler.

## Schnelle Test‑Checkliste (Pi)
1. `sudo pigpiod` (falls nicht aktiv)
2. `curl -s http://localhost:3000/api/status | jq .` → `bachlauf` Block prüfen
3. `curl -X POST -H 'Content-Type: application/json' -d '{"action":"on"}' http://localhost:3000/api/bachlauf/manual` → Pumpe an (manuell)
4. `curl -X POST -H 'Content-Type: application/json' -d '{"action":"clear"}' http://localhost:3000/api/bachlauf/manual` → zurück zu Auto
5. Stoppe pigpiod und teste `pigs w <pin> <value>` manuell, beobachte Logs
