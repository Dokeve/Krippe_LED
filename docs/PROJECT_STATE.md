# PROJECT_STATE – kompakt (Stand 2025-10-06)

- **Service:** 
ativity.service (systemd) – startet Express-Server + Scheduler.
- **Backend/APIs:** File-basierte REST-Routen für Audio, LED-Gruppen, Kalender, Modus, Dateilisten, Health, Star.
- **LED:** rpi-ws281x (GRB, GPIO 12, Brightness 128). Scheduler setzt Modus „An“/„Automatisch“ anhand Kalender.
- **Audio:** udio.json (Volume, Sprachclips, BGM); Scheduler ruft Ducking im Modul 2 auf.
- **Kalender:** calendar.json (Events, Serien-ID); Frontend + Scheduler nutzen dieselbe Datei.
- **Persistenz:** JSON in data/; MariaDB-Anbindung offen.
- **Offene Kernaufgaben:** DB-Migration, LED-Feinsteuerung (Szenarien/Lagerfeuer), Kalender-Validierung, Export/Import, Auth.

## Development workflow / Pi sync

- Lokale Entwicklung: VSCode auf Windows. Du arbeitest lokal und testest Änderungen auf der Pi‑Hardware bevor du endgültig committest.
- Push: Änderungen werden zu `origin/develop` gepusht.
- SFTP sync: Parallel synchronisierst du per SFTP mit "sync on save" auf den Raspberry Pi.
- Auf dem Pi: Nach Sync stellst du sicher, dass Arbeitsbaum mit Remote übereinstimmt:

	git fetch origin
	git reset --hard origin/develop

- Service neu starten: `sudo systemctl restart nativity.service` (oder dein Service-Wrapper). Danach API‑Test (z. B. `POST /api/bachlauf/test`).

Hinweis: Committe erst wenn Tests (Relais/Logs/API) erfolgreich sind.
