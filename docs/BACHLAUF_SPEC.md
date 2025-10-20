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

## Test‑/Verifikationsplan (Pi only)
1. Auf Pi: Sicherstellen, dass `pigpiod` läuft.
   sudo pigpiod
2. Starten: `npm start` (oder systemd service)
3. Prüfe Status: `curl -s http://localhost:3000/api/bachlauf/status | jq .`
4. Simuliere Manual ON: `curl -s -X POST -H 'Content-Type: application/json' -d '{"action":"on"}' http://localhost:3000/api/bachlauf/manual`
   - Ergebnis: Pumpe an, `manualOverride: "on"`, `source: "manual"`.
5. Setze Clear: `curl -s -X POST -H 'Content-Type: application/json' -d '{"action":"clear"}' http://localhost:3000/api/bachlauf/manual`
   - Wenn Module 2 aktiv ist, Pumpe bleibt an (source: auto), sonst aus.

## Edge‑Cases & Hinweise
- Pigpiod nicht verfügbar → Service sollte weiterhin starten, API antwortet mit Fehler im Feld `ok=false` und Diagnose‑Logs.
- Stromausfall oder Neustart → `init()` sollte `manualOverride=null` und `pumpState=off` initial setzen (sicherer Default).
- Benutzerwunsch: kein automatisches Abschalten nach Zeit — das verhindert unerwartete Abschaltungen.

## Nächste Implementations‑Schritte
1. Anlegen `services/bachlauf.js` (State machine + gpio calls).
2. Anlegen `routes/bachlauf.js` (API) und Mount in `server.js`.
3. Manuelle Tests auf Pi durchführen (s. Testplan).
4. Optional: UI Buttons in `public/bachlauf.html` / `public/js/statusbar.js` aktualisieren.

---
Wenn das so passt, implementiere ich `services/bachlauf.js` und `routes/bachlauf.js` auf der Branch; du testest dann direkt auf dem Pi. Sag kurz, ob du noch Anpassungen am Verhalten willst (z. B. persistente Override über Neustart, oder minimale On‑Time Hysterese).
