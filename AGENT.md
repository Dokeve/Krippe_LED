# AGENT.md – Weboberfläche Krippe (Stand 2025-10-03)

**Mission:** Web-UI plus Dienst zur Steuerung des LED-Bachlaufs (LED-Gruppen, Audio, Kalender/Scheduler, Sternsteuerung) auf dem Raspberry Pi.  
**Service (systemd):** `nativity.service`

---

## Ground Truth (aktuell)
- **Persistenz:** File-Stores in `data/` (`audio.json`, `calendar.json`, `led-groups.json`). MariaDB-Anbindung ist vorgesehen, aber noch nicht umgesetzt.
- **REST-APIs:** `/api/audio`, `/api/led-groups`, `/api/calendar`, `/api/list-files`, `/api/health`, `/api/star`.
- **Scheduler:** Pollt Kalenderdaten, setzt LED-Modus (`on`/`auto`) und ruft Audio-Ducking für Modul 2 auf. Zyklus 100/50/100/50 s in `config.js` hinterlegt.
- **LED-Hardware:** WS2812 (GRB, GPIO 12, Helligkeit 128). LED-Anzahl aktuell 200 (Ziel ~1000) – Anpassung noch offen.
- **Audio:** Hintergrundmusik/Sprachclips laut File-Konfiguration; Ducking + GPIO-Trigger (GPIO 13) vorbereitet.
- **Kalender:** FullCalendar-Frontend liest/schreibt über neue APIs (file-basiert). Serientermine werden clientseitig erzeugt.
- **Deployment:** `scripts/install_systemd.sh`, `systemd/nativity.service` aktiv; alte Units deaktivieren (`led-sound-bachlauf.service`, `ledsound.service`).
- **Repo:** GitHub `Dokeve/Krippe_LED`, Branch `develop`; Audio-Dateien via Git LFS.

---

## Offene Schwerpunkte
1. **MariaDB-Integration** (Queries, Migrationen, Umschalten zwischen File- und DB-Modus).
2. **LED-/Audio-Feinsteuerung** (Szenario-Zeitfenster, Lagerfeuer, GPIO-Pumpe/Button-Kopplung).
3. **Kalender-Serverlogik** (Serienverwaltung, Prioritäten bei angrenzenden Terminen, Validation).
4. **Export/Import & Auth** (Dateien, Sicherheitskonzept, API-Schutz).
5. **Tests & Monitoring** (Unit-/Integrationstests, Logging, Error-Handling).

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
- **docs/**: Status-/Subsystem-Dokumentation
- **services/**: LED-/Audio-/Scheduler-Module + File-Stores
- **routes/**: REST-Router (`audio`, `calendar`, `led-groups`, `list-files`, `health`, `star`)
- **data/**: JSON-Persistenz (aktuelle Source of Truth)
- **scripts/** & **systemd/**: Deployment & Service
- **public/**: Statische Frontend-Seiten

Siehe `Results.md` für die aktuelle Soll/Ist-Analyse.
