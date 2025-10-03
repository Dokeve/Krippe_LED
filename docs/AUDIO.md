# AUDIO (Status)

- File-Store: `data/audio.json` (Volume, Sprachclips, Hintergrundmusik).
- API: `GET/PUT /api/audio`, Dateiauswahl via `GET /api/list-files?path=…` (whitelist: Speech/BGM-Verzeichnisse).
- Scheduler: Modul 2 ruft `tickAudio(second)` für Ducking & Clips auf.

Offene Schritte:
1. MariaDB-Anbindung (`audio_entries`), Umschalten per `USE_FILE_DB`.
2. GPIO-Button-Trigger (GPIO 13) inklusive Debounce.
3. Fortschrittliche Validierung (überlappende Zeiträume, parallele Clips).
