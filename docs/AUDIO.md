# AUDIO (Status)

Geplante Funktionen laut Anforderungen:
- Hintergrundmusik (Tag/Tag-Nacht/Nacht/Nacht-Tag) mit Szenario-Abhängigkeit
- Sprachclips mit Datumsspanne, GPIO-Trigger (GPIO 13) und Ducking
- Dateiauswahl aus `/home/singer/led-sound-bachlauf/audio/krippe/...`

Aktueller Stand:
- `services/audio-scenario.js` enthält Grundlogik für Ducking und Pfade (steuerbar via `.env`).
- Datenquelle (`db.getAudio()`) und REST-API fehlen; Frontend (`public/audio.html`) speichert nicht.
- Scheduler ruft keine Audiofunktionen auf.

To-do:
1. DB-Schema/Queries für Audioeinträge definieren.
2. API (`routes/audio.js`) implementieren und Frontend anbinden.
3. Scheduler-/GPIO-Events mit Audiofunktionen verknüpfen.
