# TASKS (Nächste Schritte)

1. **Persistenz/DB**
   - MariaDB-Schema finalisieren (settings, audio, led, calendar)
   - DAO/Query-Schicht implementieren (Fallback: JSON bleibt möglich)
2. **LED-/Audio-Steuerung**
   - LED-Gruppenlogik (Farben, Wand/Szenarien, Lagerfeuer) in `led-controll`
   - GPIO-Pumpe & Button koppeln, Helligkeit/LED_COUNT auf Ist-Werte anpassen
3. **Kalender-Serverlogik**
   - Serientermine serverseitig expandieren, Priorisierung angrenzender Termine
   - Validierung & Konfliktauflösung
4. **REST-Erweiterungen**
   - Import/Export-Endpoints, Auth (API-Key o.ä.), Error-Handling verbessern
5. **Frontend & Tests**
   - UI-Feedback (Speichererfolg/Fehler), Validierungen
   - Unit-/Integrationstests für Stores, Scheduler, Routen
