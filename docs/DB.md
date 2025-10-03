# DB – Skizze

Aktuell: File-Stores (`data/audio.json`, `data/led-groups.json`, `data/calendar.json`). MariaDB bleibt Zielsystem.

Geplante Tabellen (vgl. `Grundlagen.txt`):
- `settings`
- `audio_entries` (Sprachclips + BGM)
- `led_groups`, `led_subgroups`, `scenarios`
- `calendar_events`

Nächste Schritte:
1. Migrationen & Schema finalisieren (`migrations/`).
2. DAO-Schicht/Queries implementieren, Umschalter `USE_FILE_DB` nutzen.
3. REST-APIs auf MariaDB-Backends umstellen, File-Stores als Fallback behalten.
