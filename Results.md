# Results

## Erfüllte Randbedingungen (Stand 2025-10-03)
- Grundlegender Express-Server mit statischer Auslieferung und Health-Endpunkt ist vorhanden (`server.js`).
- Morgan-Logging wurde integriert und kann per `.env` gesteuert werden (`server.js`, `config.js`, `.env`).
- Zentrale Konfiguration liest `.env` und bildet Basiswerte für Pfade, GPIOs und Zykluslängen ab (`config.js`).
- Systemd-Skripte und Deploy-Hilfen liegen vor (`scripts/install_systemd.sh`, `systemd/nativity.service`).

## Nicht erfüllte / inkonsistente Randbedingungen
- LED-Steuerung: Es existiert kein funktionsfähiger Backend-Endpunkt für LED-Gruppen (in `routes/` liegt nur `api.js`), Scheduler-Logik ist uneinheitlich (`scheduler.js` nutzt `require`, `services/scheduler.js` ist unvollständig) und die LED-Anzahl ist in `.env`/`config.js` auf 200 statt geforderter ~1000 gesetzt.
- Audio-Modul: `services/audio-scenario.js` erwartet `db.getAudio()`, die Funktion existiert in `services/db.js` jedoch nicht; GPIO-Trigger und Ducking-Logik sind nicht angebunden.
- Kalender/FullCalendar: Keine implementierten API-Routen (`GET/PUT /api/calendar` etc.), Frontend arbeitet aktuell statisch. Anforderungen zu Modul 1/2, Farbcodierung und Serienterminen werden nicht erfüllt.
- Export/Import: README verspricht JSON-Importe, entsprechende Routen/Skripte fehlen.
- Datenbank: `services/db.js` bietet nur einen Connection-Pool und Hilfsfunktionen; zentrale `query`-Methode und Migrationslogik fehlen, `schema.js` bleibt CommonJS und wird nirgends verwendet.
- Dokumentierte GPIO- und Szenarioanforderungen (Grundlagen.txt Punkte 4–9) sind nicht umgesetzt bzw. nur rudimentär in Kommentaren vorbereitet.

## Projektstruktur & Konsistenz
- Doppelter Scheduler: `scheduler.js` (CommonJS, verwendet `require`) kollidiert mit `services/scheduler.js` (ESM, unvollständig). Der dynamische Import in `server.js` scheitert dadurch.
- Routen-Ordner enthält nur `api.js` und `star.js` (nach Umstellung). Erwartete Dateien (`audio.js`, `calendar.js`, `led-groups.js`, `health.js`) fehlen vollständig.
- Services nutzen gemischte Modul-Formate: `schema.js` und CLI-Skripte (`led_strip_test.js`, `_led_test_62.js`) verbleiben in CommonJS; neuere Services sind ESM. Dadurch bestehen Inkonsistenzen bei Imports.
- Daten-/Konfigurationspfade sind teils falsch geschrieben (`Audioprachdateien`), was beim Zugriff auf reale Pfade scheitern kann.

## Dokumentationslage
- `README.md` beschreibt zahlreiche Features (Kalender-API, Export/Import, automatisches Speichern), die aktuell nicht existieren – veraltet/irreführend.
- `AGENT.md` listet „morgan“-Integration noch als offenen Punkt, obwohl bereits umgesetzt.
- `docs/`-Markdowns skizzieren Zielzustände, aber keine aktuellen Statusangaben; Aktualisierungen fehlen.
- Grundlagen.txt wird nicht in Projektdokumentation gespiegelt; Anforderungen sind nicht nachverfolgbar.

## Empfehlungen (Kurz)
1. Scheduler vereinheitlichen (ESM, funktionsfähige LED-/Audio-Integration) und notwendige DB-Methoden ergänzen.
2. Fehlende REST-Endpunkte für LED-Gruppen, Audio, Kalender implementieren oder README an den tatsächlichen Funktionsumfang anpassen.
3. Pfad-/Konfigurationswerte (LED_COUNT, Audio-Verzeichnisse) mit den realen Vorgaben abgleichen.
4. Dokumentation konsolidieren (`AGENT.md`, `README.md`, `docs/*`) und veraltete Aussagen entfernen.
