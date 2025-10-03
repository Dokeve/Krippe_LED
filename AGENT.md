# AGENT.md – Weboberfläche Krippe (Stand 2025-10-03)

**Mission:** Entwicklung einer Web-UI plus Dienst zur Steuerung des LED-Bachlaufs (LED-Gruppen, Audio, Kalender/Scheduler, Sternsteuerung) auf dem Raspberry Pi.  
**Service (systemd):** `nativity.service`

---

## Ground Truth (aktuell)
- **Persistenz:** Ziel ist MariaDB als Quelle der Wahrheit (Settings, Kalender, Audio-Listen); derzeit existieren nur Verbindungs-Hilfen, aber keine produktiven Queries/Routen. `data/star.json` bleibt Datei-basiert.
- **LED-Hardware:** WS2812 (ALT-Lib `rpi-ws281x`), GRB, GPIO 12, Standardhelligkeit 128. LED-Anzahl im Code aktuell 200 – Zielwert laut Anforderungen ~1000 (Anpassung offen).
- **Zyklus/Szenarien:** 4-Phasen-Zyklus (Tag 100 s, Tag→Nacht 50 s, Nacht 100 s, Nacht→Tag 50 s) in `config.js` hinterlegt; Umsetzung im Scheduler noch ausstehend.
- **Bachlauf/Pumpe:** GPIO 19 (active_low) geplant, logische Anbindung folgt.
- **Audio:** Vorgesehen sind Tag/Nacht-Loops + datumsabhängige Sprachclips inkl. Ducking und GPIO-Trigger (GPIO 13). Backend-Routen & Scheduler-Integration fehlen noch.
- **Kalender:** FullCalendar-Frontend liegt bereit, API/DB-Anbindung und Modul-Logik sind TODO.
- **Web-UI:** Statische Seiten (`public/`) vorhanden; Export/Import-Funktionen sind nur beschrieben, nicht implementiert.
- **Deployment:** `scripts/install_systemd.sh` und `systemd/nativity.service` richten Dienst ein; alte Units (`led-sound-bachlauf.service`, `ledsound.service`) sollen deaktiviert bleiben.
- **Repo:** GitHub `Dokeve/Krippe_LED`, Branch `develop`; Audio-Dateien via Git LFS.
- **Offene Schwerpunkte:** REST-API für Kalender/LED/Audio, Scheduler-Harmonisierungen, DB-Layer (`query`, `getAudio` etc.), Frontend-Binding, LED-Zeitfenster & Audio-Timeline laut `Grundlagen.txt`.

---

## Codex Agent – Projektkennung
- `codex_agent_conversation_id`: **fb935d75e9d12124**  
- Datei: `codex/PROJECT_ID.json`

---

## Standard-Kommandos (Pi)
```bash
cp .env.example .env
npm ci --omit=dev
sudo ./scripts/install_systemd.sh
sudo systemctl status nativity -n 100
```

---

## Dateikarte (Kurz)
- **Root:** `README.md`, `AGENT.md`, `Results.md`, `Grundlagen.txt`
- **docs/**: Status-/Subsystem-Notizen (AUDIO, CALENDAR, DB, LED-CONFIG, PROJECT_STATE, SYSTEMD, TASKS, TROUBLESHOOTING)
- **config/**: JSON-Defaults (z. B. `config/default.json`)
- **services/**: LED-/Audio-/Star-Module (gemischter ESM/CJS-Stand)
- **routes/**: Express-Router (`api.js`, `star.js`)
- **scripts/** & **systemd/**: Deployment & Service
- **public/**: Statische Frontend-Seiten ohne aktive API-Anbindung

Siehe `Results.md` für den jeweils letzten Stand der Soll/Ist-Analyse.
