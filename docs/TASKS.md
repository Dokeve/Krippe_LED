# TASKS (Nächste Schritte)

## Hohe Priorität

- **LED-Hardware in Betrieb nehmen**
  - WS2812 real testen (Init, Modus "An" vs. "Automatisch", Lagerfeuer‑Platzhalter prüfen).
  - GPIOs prüfen: Pumpenrelais, Audio‑Button, Helligkeit/LED_COUNT an echte Werte anpassen.
  - [x] Auto-Modus entprellt (nur bei Zustandswechsel wird erneut gerendert).
- **Persistenz/DB**
  - MariaDB-Schema finalisieren (Settings, Audio, LED, Kalender).
  - DAO/Query‑Schicht implementieren; File‑Store als Fallback behalten.

## Mittlere Prioritaet

- **LED-/Audio-Steuerung**
  - LED‑Gruppenlogik (Farben, Wand/Szenarien, Lagerfeuer) in `led-controll` erweitern.
  - Audio‑Ducking und Sprachclips sauber mit Kalender/Modul‑Logik verknüpfen.
- **Kalender-Serverlogik**
  - Serientermine serverseitig expandieren, angrenzende Termine priorisieren.
  - Konfliktauflösung und Plausibilitäts‑Checks implementieren.
- **REST-Erweiterungen**
  - Import/Export‑Endpoints, Auth (API‑Key o.ä.), Fehlerrückgaben verbessern.
- **Frontend & Tests**
  - UI‑Feedback (Speichererfolg/Fehler), Validierungen.
  - Unit‑/Integrationstests für Stores, Scheduler, Routen.

## Niedrige Priorität

- **Globaler Footer**
- Einheitliche Fußzeile mit „Letzte Änderung“ auf allen Seiten einbauen.
