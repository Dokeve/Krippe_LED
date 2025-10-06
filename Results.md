# Results

## Erfüllte Randbedingungen (Stand 2025-10-03)
- Express-Server mit statischer Auslieferung, Health-Endpoints und Morgan-Logging.
- File-basierte REST-APIs für Audio (`/api/audio`), Kalender (`/api/calendar`), LED-Gruppen (`/api/led-groups`), Modus (`/api/mode`) sowie Dateilisten (`/api/list-files`).
- Scheduler pollt Kalenderdaten, schaltet LED-Modus und startet Audio-Ducking für Modul 2.
- LED-/Audio-/Kalender-Konfiguration wird in `data/*.json` persistiert; Frontend ist an die APIs angebunden.
- Systemd-/Deploy-Skripte vorhanden (`scripts/install_systemd.sh`, `systemd/nativity.service`).

## Noch offen / Risiken
- **MariaDB-Integration:** Derzeit reine File-Stores; Queries, Migrationen und Umschalter fehlen.
- **LED-Steuerung:** Szenario-/Lagerfeuer-Logik, individuelle Farben und GPIO-Pumpe müssen serverseitig umgesetzt werden (derzeit nur Grundversorgung).
- **Audio:** GPIO-Trigger (Button), parallele Clip-Verwaltung und erweiterte Validierung (Zeitintervalle) stehen aus.
- **Kalender:** Serientermin-Handling serverseitig, Konfliktauflösung und Priorisierung angrenzender Einträge fehlen.
- **Export/Import & Sicherheit:** Authentifizierung, Fehlermanagement, API-Guards, Import/Export-Flows sind offen.

## Struktur & Konsistenz
- Alt-Scheduler entfernt; neuer ESM-Scheduler in `services/` nutzt File-Stores.
- Alle erwarteten Router vorhanden (`audio`, `calendar`, `led-groups`, `list-files`, `health`, `star`).
- Services konsistent im ESM-Stil, File-Stores kapseln Persistenz.
- `config.js`/`.env` weiter mit LED_COUNT=200 (Anpassung auf ~1000 erforderlich, sobald Hardware bestätigt).

## Dokumentationslage
- README/AGENT/docs aktualisiert (aktueller Stand, offene Aufgaben, File-basierte Persistenz).
- `docs/TASKS.md` führt priorisierte Arbeiten (DB, Scheduler-Feinheiten, REST-Features) auf.

## Empfehlungen (kurz)
1. DB-Schicht implementieren (MariaDB-Queries, Migrationen) und APIs darauf umstellen.
2. LED-/Audio-Szenario-Logik komplettieren (Wand-Fades, Lagerfeuer, GPIOs, LED_COUNT).
3. Kalender-Serverlogik erweitern (Serien, Konflikte) und Tests ergänzen.
4. Import/Export, Auth und Fehlerhandling einbauen.

- .env-Zykluszeiten werden nun über dotenv geladen (npm install erforderlich).
