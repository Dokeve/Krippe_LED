# CALENDAR (Status)

- File-Store: `data/calendar.json` (Event-Liste, optional seriesRoot).
- API: `GET/PUT /api/calendar`, `POST /api/calendar/save` (Fallback).
- Scheduler: Pollt alle 5 s, setzt Modul 1/2, übergibt Zyklus-Sekunde an LED/Audio.

Offene Schritte:
1. Datenbank-Anbindung & Server-Seitige Serienberechnung.
2. Validierung (Überlappungen, angrenzende Einträge, Modul-Prioritäten).
3. Optimierung Scheduler (Delta-Updates, Ereignis-Caching, Konfigurierbare Intervalle).
