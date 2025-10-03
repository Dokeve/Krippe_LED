# CALENDAR (Status)

Geplante Features:
- FullCalendar-Frontend mit Monats-/Wochen-/Tagesansicht
- Einträge mit Start/Ende, Modul 1 (gelb) / Modul 2 (blau), Serientermine
- Export/Import der Kalenderdaten (JSON)
- Scheduler-Anbindung zur Steuerung von LED/Audio-Modulen

Aktueller Stand:
- Frontend `public/calendar.html` & `public/js/calendar.js` vorhanden, jedoch ohne aktive API.
- REST-Routen (`GET/PUT /api/calendar`, `POST /api/calendar/save`) nicht implementiert.
- Datenbanktabellen/Migrationslogik für Kalender nur rudimentär skizziert (`schema.sql`).
- Scheduler reagiert noch nicht auf Kalenderdaten.

To-do:
1. API-Router `routes/calendar.js` erstellen und mit DB verbinden.
2. Frontend an neue Endpunkte koppeln (CRUD, Farben, Serientermine).
3. Scheduler-Integration implementieren (Modul 1/2 Umschaltung, Prioritätslogik bei angrenzenden Terminen).
