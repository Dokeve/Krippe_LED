# PROJECT_STATE – kompakt (Stand 2025-10-03)

- **Service:** `nativity.service` (systemd) – startet Express-Server (`server.js`).
- **Backend:** Grundgerüst aktiv (Health, Mode, Star-Router); Kalender/LED/Audio-APIs fehlen.
- **LED:** ALT-Lib (GRB, GPIO 12, Brightness 128). Scheduler/Moduswechsel noch nicht angebunden.
- **Audio:** `services/audio-scenario.js` bereitet Ducking/Clips vor, benötigt `db.getAudio()` und Scheduler-Trigger.
- **Kalender:** FullCalendar-Frontend vorhanden; DB/REST-Anbindung offen.
- **Datenbank:** Pool-Konfiguration und Config vorhanden; Queries/Migrationsworkflow fehlen.
- **Logging:** Morgan integriert, steuerbar via `.env`.
- **Offene Kernaufgaben:** API-Implementierung, Scheduler-Konsolidierung, Persistenz, Frontend-Binding.
