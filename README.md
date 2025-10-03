# LED Sound Bachlauf – Steuerung & Weboberfläche

Der aktuelle Entwicklungsstand liefert ein Express-Grundgerüst mit statischen Seiten, File-basierten REST-APIs (Audio/Kalender/LED-Gruppen) und einem Scheduler, der auf Kalenderereignisse reagiert. Ziel ist ein kompletter Steuerdienst für LED-Bachlauf, Audio und Kalender auf dem Raspberry Pi.

---

## Aktueller Stand
- Express-Server inkl. Morgan-Logging, Health-Endpunkte und dynamischem Routing (`server.js`).
- REST-APIs (Dateibasiert, JSON in `data/`):
  - `GET/PUT /api/audio` → `data/audio.json`
  - `GET/PUT /api/led-groups` → `data/led-groups.json`
  - `GET/PUT /api/calendar`, `POST /api/calendar/save` → `data/calendar.json`
  - `GET /api/list-files?path=…` (Whitelisted Audio-Verzeichnisse)
- Scheduler (`services/scheduler.js`) pollt Kalenderdaten, schaltet LEDs (Modus an/auto) und triggert Audio-Ducking (Modul 2).
- LED-, Audio- und Kalender-Services über File-Stores (`services/*-store.js`), `led-controll` nutzt diese Konfigurationen.
- Deployment-Hilfen: `scripts/install_systemd.sh`, `systemd/nativity.service`.

### Noch offen / Nächste Schritte
- MariaDB-Integration (aktuell File-DB via JSON), Migrationen und vollständige Persistenz.
- Erweiterte LED-/Audio-Logik (individuelle Szenarien, Lagerfeueranimation, GPIO/Pumpe-Kopplung).
- Vollständiges Kalender-Verhalten (Serienlogik, angrenzende Termine) serverseitig prüfen.
- Import/Export-Flows, Authentifizierung, Fehlerhandling.

---

## Installation & Nutzung
```bash
# Repository klonen
git clone <repo-url> led-sound-bachlauf
cd led-sound-bachlauf

# Abhängigkeiten installieren
npm install

# Entwicklungsstart (statische Seiten + APIs + Scheduler)
npm start
```

### Deployment (Pi)
```bash
cp .env.example .env
npm ci --omit=dev
sudo ./scripts/install_systemd.sh
sudo systemctl restart nativity
```
> Hinweis: Für produktiven Einsatz sind die oben genannten offenen Punkte (DB-Anbindung, Hardware-Integration) noch umzusetzen.

---

## Projektstruktur
```
.
├── public/           # HTML/CSS/JS-Frontend (verwendet /api/audio|calendar|led-groups|list-files)
├── routes/           # Express-Router (audio, calendar, led-groups, list-files, health, star)
├── services/         # LED-/Audio-/Scheduler-Logik, File-Stores
├── scripts/          # Deployment-Skripte
├── systemd/          # nativity.service
├── data/             # Persistenz (audio.json, calendar.json, led-groups.json)
├── docs/             # Status-/Subsystem-Dokumentation
└── Grundlagen.txt    # Anforderungskatalog
```

---

## Weiteres Vorgehen
1. DB-Layer auf MariaDB heben (DAO/Queries) und File-Stores als Fallback behandeln.
2. LED-/Audio-Scheduler-Logik erweitern (Szenarien, Lagerfeuer, GPIO-Pumpe, Button).
3. REST-APIs um Validierung, Fehlercodes, Import/Export ergänzen.
4. Frontend mit erweiterten Statusmeldungen/Validierungen ausstatten.
5. Dokumentation & Tests kontinuierlich nachziehen (`docs/`, `Results.md`).
