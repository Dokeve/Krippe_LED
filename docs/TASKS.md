# TASKS (Nächste Schritte)

1. **REST-API fertigstellen**
   - LED-Gruppen (CRUD, Szenario-Zeitfenster, Lagerfeuer)
   - Kalender (Module 1/2, Serientermine, Farbkennzeichnung)
   - Audio (Sprachclips, Hintergrundmusik, Dateiauswahl)
2. **Scheduler konsolidieren**
   - ESM-Version vereinheitlichen, LED-/Audio-Aufrufe mit Zykluslogik verknüpfen
   - GPIO-Ansteuerung (Pumpe, Button) integrieren
3. **Persistenz erweitern**
   - `services/db.js`: generische `query`-Funktion, spezialisierte Getter/Setter (z. B. `getAudio`, `saveLedGroups`)
   - Migrationen anwenden/erweitern (`schema.sql`, `migrations/`)
4. **Frontend an APIs anbinden**
   - `public/*.html` + `public/js/*.js` auf neue REST-Endpunkte umstellen
   - Validierung, Autosave, Import/Export-Flows ergänzen
5. **Dokumentation & Konfig**
   - LED-Count und Pfade an reale Installation angleichen (`.env`, `config.js`)
   - docs/* laufend mit Status aktualisieren, Ergebnisse in `Results.md` festhalten
