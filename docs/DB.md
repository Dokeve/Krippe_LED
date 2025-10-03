# DB – Skizze

Vorgesehene Tabellen (vgl. `Grundlagen.txt`):
- `settings`
- `audio_entries` (Sprachclips + BGM-Zuweisungen)
- `led_groups` / `led_subgroups` / `scenarios`
- `calendar_events`

Aktueller Stand:
- `schema.sql` und `schema.js` enthalten nur Entwürfe; produktive Migrationen fehlen.
- `services/db.js` stellt den Pool bereit, aber keine generischen Query-Helfer.
- REST-Routen greifen noch nicht auf die DB zu.

To-do:
1. Tabellenstruktur finalisieren und Migrationen ergänzen (`migrations/`).
2. Datenzugriffsschicht (Query-Wrapper, DAO-Funktionen) implementieren.
3. API/Services an die DB anbinden.
