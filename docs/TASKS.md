# TASKS (Naechste Schritte)

## Hohe Prioritaet

- **LED-Hardware in Betrieb nehmen**
  - WS2812 real testen (Init, Modus "An" vs. "Automatisch", Lagerfeuer-Platzhalter pruefen).
  - GPIOs pruefen: Pumpenrelais, Audio-Button, Helligkeit/LED_COUNT an echte Werte anpassen.
  - [x] Auto-Modus entprellt (nur bei Zustandswechsel wird erneut gerendert).
- **Persistenz/DB**
  - MariaDB-Schema finalisieren (Settings, Audio, LED, Kalender).
  - DAO/Query-Schicht implementieren; File-Store als Fallback behalten.

## Mittlere Prioritaet

- **LED-/Audio-Steuerung**
  - LED-Gruppenlogik (Farben, Wand/Szenarien, Lagerfeuer) in `led-controll` erweitern.
  - Audio-Ducking und Sprachclips sauber mit Kalender/Modul-Logik verknuepfen.
- **Kalender-Serverlogik**
  - Serientermine serverseitig expandieren, angrenzende Termine priorisieren.
  - Konfliktaufloesung und Plausibilitaets-Checks implementieren.
- **REST-Erweiterungen**
  - Import/Export-Endpoints, Auth (API-Key o.ae.), Fehlerrueckgaben verbessern.
- **Frontend & Tests**
  - UI-Feedback (Speichererfolg/Fehler), Validierungen.
  - Unit-/Integrationstests fuer Stores, Scheduler, Routen.

## Niedrige Prioritaet

- **Globaler Footer**
<<<<<<< Updated upstream
  - Einheitliche Fusszeile mit "Letzte Aenderung" auf allen Seiten einbauen.
=======
  - Einheitliche Fußzeile mit „Letzte Änderung“ auf allen Seiten einbauen.
sjdhfkj
>>>>>>> Stashed changes
