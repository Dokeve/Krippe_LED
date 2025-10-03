# LED Sound Bachlauf – Steuerung & Weboberfläche

Dieses Repository enthält den aktuellen Entwicklungsstand der Krippen-Steuerung (LED, Audio, Scheduler) für den Raspberry Pi. Der Code basiert auf Node.js/Express und liefert momentan in erster Linie das Grundgerüst – viele in den Anforderungen (siehe `Grundlagen.txt`) genannten Funktionen sind noch nicht umgesetzt.

---

## Aktueller Stand
- Express-Server mit statischer Auslieferung (`public/`) und Health-Endpunkten ist verfügbar (`server.js`).
- Morgan-basiertes HTTP-Logging ist integriert und kann über `.env` konfiguriert werden.
- Basis-Konfiguration (`config.js`) lädt `.env`, setzt Pfade, GPIO-Werte und Zykluslängen.
- Deployment-Hilfen (systemd-Unit, Installationsskripte) liegen unter `systemd/` und `scripts/`.
- Erste Services wurden auf ES-Module portiert (u. a. `services/*`), einzelne CLI-/Testscripte verbleiben noch in CommonJS.

### Noch offen / in Arbeit
- REST-API für Kalender, LED-Gruppen, Audio (derzeit keine produktiven Routen außer `/api/mode` und `/api/star`).
- Konsolidierung der Scheduler-Implementierung (`scheduler.js` vs. `services/scheduler.js`) und Anbindung an echte LED-/Audio-Steuerung.
- Datenbank-Schicht (`services/db.js`) benötigt eine einheitliche `query`-API sowie Methoden wie `getAudio()`.
- Frontend-Seiten (`public/*.html`) besitzen noch keine Verbindung zu einem funktionsfähigen Backend.
- Dokumentation und Datenmodelle aus `Grundlagen.txt` sind nur teilweise reflektiert (LED-Zeitfenster, Kalenderlogik, Audio-Zeitsteuerung, Export/Import).

---

## Installation & Nutzung (aktuell nur Grundgerüst)
```bash
# Repository klonen
git clone <repo-url> led-sound-bachlauf
cd led-sound-bachlauf

# Abhängigkeiten installieren (enthalten bereits morgan)
npm install

# Entwicklungsstart (liefert statische Seiten und Health)
npm start
```

### Deployment-Hinweise (Pi)
```bash
cp .env.example .env
npm ci --omit=dev
sudo ./scripts/install_systemd.sh
sudo systemctl restart nativity
```
> Achtung: Ohne die oben genannten offenen Punkte ist die Anwendung noch nicht funktionsfähig für den produktiven Betrieb.

---

## Projektstruktur (Kurz)
```
.
├── public/           # Statische HTML/CSS/JS, aktuell ohne aktive API-Anbindung
├── routes/           # Express-Router (nur mode/star umgesetzt)
├── services/         # LED-/Audio-/Star-Services (teilweise ESM, teilweise TODO)
├── scripts/          # Deploy-/Systemd-Hilfen
├── systemd/          # nativity.service
├── docs/             # Kurzdokumente zu Status/Subsystemen
└── Grundlagen.txt    # Vollständige Anforderungsliste
```

---

## Weiteres Vorgehen
1. API-Routen für Kalender, LED-Gruppen, Audio implementieren und mit der DB verkabeln.
2. Scheduler vereinheitlichen (ESM) und reale Steuerungslogik/Hardwarezugriffe ergänzen.
3. Datenbank-/Persistenzschicht fertigstellen (Query-Hilfen, Migrationen nutzen).
4. Frontend an neue APIs anschließen, Funktionen aus `Grundlagen.txt` iterativ umsetzen.
5. Dokumentation fortlaufend mit dem tatsächlichen Stand synchron halten.

Für Detailaufgaben siehe `docs/TASKS.md` sowie die Analyse in `Results.md`.
