# BACHLAUF Spezifikation

Dieses Dokument beschreibt die gewünschte Implementierung des Bachlauf‑(Pumpen)‑Dienstes auf der Branch `feature/bachlauf-redesign`.
Wichtig: Der User testet ausschliesslich auf dem Raspberry Pi — keine Mocks oder Simulationen.

## Kurzbeschreibung / Ziel
- Die Pumpe soll automatisch eingeschaltet werden, wenn Modul 2 aktiv ist, und ausgeschaltet werden, wenn Modul 2 nicht aktiv ist.
- Zusätzlich soll es eine manuelle Steuerung geben: manuelles AN, manuelles AUS und Rücksetzen auf Auto. Manuelle Aktionen wirken sofort.
- Kein automatisches Safety‑Auto‑Off (keine maximale Laufzeit). Ein manuelles Ausschalten schaltet sofort aus und bleibt aktiv, bis der Benutzer wieder ändert.

## Betriebslogik (State Machine)
- Zustände (logical): `OFF`, `ON`.
- Steuerquelle (priority):
  1. Manuelle Steuerung (falls gesetzt): `manual = 'on'|'off'` → setzt Pumpe entsprechend permanent bis `clear`.
  2. Automatik: folgt `module2Active` (true = ON, false = OFF) nur wenn keine manuelle Override aktiv ist.

Transitions:
- Wenn `manual==null` und `module2Active==true` → setze Pumpe ON.
- Wenn `manual==null` und `module2Active==false` → setze Pumpe OFF.
- Wenn `manual=='on'` → Pumpe ON (unabhängig von Module2).
- Wenn `manual=='off'` → Pumpe OFF (unabhängig von Module2).

## API (HTTP, JSON)
Alle Endpoints unter `/api/bachlauf` (Express‑Router `routes/bachlauf.js`).

1) GET /api/bachlauf/status
   - Antwort (200):
     {
       "ok": true,
       "pumpState": "on" | "off",
       "source": "auto" | "manual",
       "module2Active": true|false,
       "manualOverride": null | "on" | "off"
     }

2) POST /api/bachlauf/manual
   - Body (application/json): { "action": "on" | "off" | "clear" }
   - Verhalten:
     - "on" setzt `manual='on'` (Pumpe sofort ON)
     - "off" setzt `manual='off'` (Pumpe sofort OFF)
     - "clear" entfernt das manuelle Override (zurück in Auto‑Betrieb)
   - Antwort: aktueller Status wie bei GET /status

3) (Optional) POST /api/bachlauf/test
   - Nur für kurze Hardware‑Verifikation vorgesehen (z. B. Pulse 1s) — Implementierung optional auf Wunsch.

Fehler: Konsistente Fehlerantworten { ok: false, error: 'message' } mit geeigneten HTTP‑Codes.

## Scheduler / Integration
- `services/scheduler.js` überwacht Modul‑Zustände (Module 2). Bei Statusänderung ruft sie `bachlauf.setModule2Active(true|false)` oder `bachlauf.onModule2Change(active)` auf.
- Der Bachlauf‑Service entscheidet anhand `manualOverride` ob es die Pumpe schaltet. Wenn `manualOverride` gesetzt ist, ignoriert der Scheduler die Zustandsänderung für den physischen Ausgang.

## Services / Dateien (Implementationsplan)
- `services/bachlauf.js` (neu):
  - Exportiert: `getStatus()`, `setManual(action)`, `clearManual()`, `handleModule2(active)`, `init()`.
  - Pflegt internen Zustand: `{ pumpState: 'on'|'off', manualOverride: null|'on'|'off', module2Active: bool }`.
  - Nutzt `services/gpio.js` (existing) zum eigentlichen Schalten der Pumpe: `gpio.setPump(true|false)`.

- `routes/bachlauf.js` (Router):
  - Mount unter `/api/bachlauf` in `server.js`.
  - Implementiert die API oben.

## GPIO / Hardware
- Die Implementierung muss konfigurabel sein für ActiveHigh/ActiveLow Relais (ENV: `PUMP_ACTIVE_HIGH=true|false`, `PUMP_GPIO_PIN=<pin>`).
- Voraussetzung: `pigpiod` läuft auf dem Pi und `services/gpio.js` ist dafür vorbereitet. Beim Start prüft `bachlauf.init()` die Verfügbarkeit und loggt Fehler (keine Blind‑Fails).

Konfigurations‑Beispiele (.env):
PUMP_GPIO_PIN=17
PUMP_ACTIVE_HIGH=true

Hinweis: Falls du unsicher bist, welchen Relay‑Typ du hast, setze `PUMP_ACTIVE_HIGH` so, dass `true` an der API `pump on` physisch die Pumpe einschaltet. Teste vorsichtig mit einem Multimeter oder kurzen 1s Puls.

SS## Betriebs‑ und Testhinweise
Operative Hinweise, Start/Restart‑Schritte, Troubleshooting und ausführliche Test‑Checklist befinden sich in:

- `docs/TROUBLESHOOTING.md` (pigpiod, pigs‑Fallback, Logs, kurze Checkliste)
- `docs/SYSTEMD.md` (Anleitung zum Deployen der `systemd/nativity.service` Unit)
- `docs/LED-CONFIG.md` und `Results.md` (UI/LED/HW‑Hinweise und Test‑Ergebnisse)

Bitte die oben genannten Dateien für Betriebsanweisungen und Troubleshooting konsultieren. Diese Spezifikation bleibt auf API, State‑Machine und Integrations‑Contract fokussiert.

## Nächste Implementations‑Schritte
1. Anlegen `services/bachlauf.js` (State machine + gpio calls).
2. Anlegen `routes/bachlauf.js` (API) und Mount in `server.js`.
3. Manuelle Tests auf Pi durchführen (s. Testplan).
4. Optional: UI Buttons in `public/bachlauf.html` / `public/js/statusbar.js` aktualisieren.

## Änderungsprotokoll — seit letzter Aktualisierung
Die Implementierung wurde erweitert und auf dem Raspberry Pi getestet. Wichtige Änderungen und Ergänzungen seit der ursprünglichen Spezifikation:

### 1) Robuste GPIO‑Initialisierung und Fallback
- `services/gpio.js` wartet beim Start auf die Verfügbarkeit von `pigpiod` (prüft PID/Socket), führt konfigurierbare Retry‑Schleifen durch (env: `GPIO_INIT_MAX_ATTEMPTS`, `GPIO_INIT_RETRY_DELAY_MS`).
- Wenn `pigpiod` nicht verfügbar oder gpioInitialise fehlschlägt, nutzt die Implementation als Fallback die CLI `pigs` (sofern im PATH) für einzelne Pin‑Schreibzugriffe (z. B. `pigs w <pin> <value>`). Das erlaubt Betrieb auch bei pigpiod‑Startproblemen.
- `setPump(on)` in `services/gpio.js` merkt sich den gewünschten Zustand (`desiredPumpState`) und versucht, ihn mit pigpio umzusetzen oder per `pigs`‑Fallback.
- Environment‑Variablen für Pin und Logik bleiben gültig: `PUMP_GPIO_PIN`, `PUMP_ACTIVE_HIGH`.

### 2) Bachlauf Service (implementiert)
- `services/bachlauf.js` wurde angelegt und implementiert die im Spec beschriebene State‑Machine (Felder: `pumpState`, `manualOverride`, `module2Active`).
- Exportierte API: `init()`, `getStatus()`, `setManual(action)`, `clearManual()`, `handleModule2(active)`.
- Beim Start initialisiert der Service den sicheren Default (`manualOverride = null`, `pumpState = 'off'`) und loggt Fehler, falls GPIO nicht zur Verfügung steht.

### 3) HTTP Router / Integration
- `routes/bachlauf.js` wurde implementiert und in `server.js` gemountet unter `/api/bachlauf`.
- Zusätzlich wurde `/api/status` (in `routes/status.js`) erweitert: Wenn der Bachlauf‑Service vorhanden ist, liefert `/api/status` jetzt einen `bachlauf`‑Block mit Laufzeit‑Informationen (z. B. `running`, `pumpState`, `source`, `manualOverride`). Das erlaubt dem Frontend, die Statusleiste zentral zu befüllen.

### 4) Frontend: Statusbar & Bachlauf UI
- `public/js/statusbar.js` ist jetzt die einzige Routine, die die globale Statusleiste schreibt (Polling `/api/status`, 1s). Das verhindert konkurrierende DOM‑Schreibzugriffe durch mehrere Seiten‑Skripte.
- `public/js/bachlauf.js` wurde angepasst, sodass es die globalen Status‑Elemente nicht mehr überschreibt, sondern nur seine eigene Anzeige (`bachlauf‑Quelle`, Buttons für Manual ON/OFF/CLEAR) aktualisiert und über `/api/bachlauf` steuert.

### 5) LED‑Seite: Lagerfeuer & UI‑Verbesserungen
- `public/js/led-groups.js` wurde angepasst:
  - Gruppen sind beim ersten Laden standardmäßig eingeklappt (vereinfacht die Navigation bei vielen Gruppen).
  - Lagerfeuer‑Szenarien werden korrekt geladen und gerendert (`lagerfeuer.scenarios`) und beinhalten keine LED‑Auswahl mehr (Lagerfeuer ist zeitbasiert, nicht per‑LED‑Einzelzuweisung).
  - `save`/`load`‑Logik wurde stabilisiert, so dass Lagerfeuer‑Szenarien nicht mehr versehentlich LED‑Auswahlfelder erwarten oder überschreiben.

### 6) Systemd / Deployment Hinweis
- `systemd/nativity.service` wurde in der Repo‑Kopie angepasst (Start‑Umgebung, Node‑Startpfad, Restart‑Policy). Änderung im Repo wirkt erst nach Deployment auf dem Pi (z. B. `sudo cp systemd/nativity.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart nativity`).

### 7) On‑Pi Tests (durchgeführt)
- `pigpiod`‑Startprobleme identifiziert: abgestutzte PID/Socket waren Ursache für gpioInitialise‑Fehler; Bereinigung (Entfernen der stale PID/Socket) und Neustart von pigpiod nötig.
- `pigs w <pin> <value>` getestet: physische Pumpe (BCM22 im Test‑Setup) reagiert; Hardware zeigte Active‑LOW Verhalten (0 = ON für das getestete Relais, abhängig vom Relay‑Modul).
- API‑Tests mit `curl` bestätigt: `GET /api/bachlauf/status` liefert Status; `POST /api/bachlauf/manual` mit `{"action":"on"}` / `{"action":"off"}` / `{"action":"clear"}` ändern `manualOverride` und den realen Pumpen‑Ausgang.

### 8) Logging / Fehlerverhalten
- Bei fehlender GPIO‑Anbindung loggt der Server wiederholte Versuche und gibt in API‑Antworten nützliche Fehlerdetails (z. B. `{ ok: false, error: 'pigpio not available' }`).
- Beim GPIO‑Fallback per `pigs` werden Exitcodes erfasst und in Logs protokolliert.

## Aktualisierter Testplan / Checkliste (Pi only)
1. Sicherstellen, dass `pigpiod` läuft oder dass `pigs` im PATH ist.
2. Starten: `npm start` bzw. systemd service (siehe Systemd Hinweis).
3. Status Poll: `curl -s http://localhost:3000/api/status | jq .` → `bachlauf` Block prüfen.
4. Direkter Bachlauf Status: `curl -s http://localhost:3000/api/bachlauf/status | jq .`
5. Manual ON: `curl -s -X POST -H 'Content-Type: application/json' -d '{"action":"on"}' http://localhost:3000/api/bachlauf/manual` → Pumpe sollte an.
6. Manual OFF: analog `{"action":"off"}` → Pumpe aus.
7. Clear: `{"action":"clear"}` → Verhalten nach `module2Active` prüfen (falls Modul 2 aktiv → Pumpe an).
8. Test GPIO‑Fallback: bewusst `pigpiod` stoppen und `pigs` nutzen; kontrolliere Logs und ob `pigs` Befehle die Pumpe schalten.

## Empfehlungen / Offene Punkte
- Persistente Speicherung des manuellen Overrides über einen Neustart: aktuell ist `manualOverride` flüchtig (wird auf `null` beim Start gesetzt). Wenn persistente Overrides gewünscht sind, kann ein kleines JSON‑File oder DB‑Eintrag ergänzt werden.
- Optionales Safety‑Timeout (z. B. max. 30 Minuten Laufzeit) wurde bewusst nicht implementiert nach Anforderung. Falls später gewünscht, kann dies als zusätzliche Policy eingebaut werden.
- PR‑Workflow: Erstelle bitte einen Pull Request `feature/bachlauf-redesign -> develop` und lasse CI laufen; Review‑Requests sollten auf Tests in einer Pi‑Umgebung hinweisen (Hardware‑Tests können nicht CI‑automatisiert werden).

---

Wenn du willst, übernehme ich diese Datei auch in `docs/TASKS.md` oder `docs/PROJECT_STATE.md` als Release‑Notiz. Soll ich die Änderungen jetzt committen und einen PR öffnen (branch `feature/bachlauf-redesign`) oder möchtest du erst noch etwas ergänzen?

---
Wenn das so passt, implementiere ich `services/bachlauf.js` und `routes/bachlauf.js` auf der Branch; du testest dann direkt auf dem Pi. Sag kurz, ob du noch Anpassungen am Verhalten willst (z. B. persistente Override über Neustart, oder minimale On‑Time Hysterese).
