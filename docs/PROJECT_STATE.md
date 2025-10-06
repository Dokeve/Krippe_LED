# PROJECT_STATE – kompakt (Stand 2025-10-03)

- **Service:** `nativity.service` (systemd) – startet Express-Server + Scheduler.
- **Backend/APIs:** File-basierte REST-Routen für Audio, LED-Gruppen, Kalender, Modus, List-Files, Health, Star.
- **LED:** ALT-Lib (GRB, GPIO 12, Brightness 128). Scheduler setzt Modus on/auto per Kalender.
- **Audio:** `audio.json` (Volume, Sprachclips, BGM); Scheduler ruft Ducking im Modul 2 auf.
- **Kalender:** `calendar.json` (Events, Serien ID); Frontend + Scheduler nutzen dieselben Daten.
- **Persistenz:** JSON in `data/`; MariaDB-Anbindung offen.
- **Offene Kernaufgaben:** DB-Migration, LED-Feinsteuerung (Szenarien/Lagerfeuer), Kalender-Validierung, Export/Import, Auth.


