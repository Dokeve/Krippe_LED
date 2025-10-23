# LED-Konfiguration (WS281x)

| Parameter   | Aktueller Wert        | Soll laut Anforderungen |
|-------------|-----------------------|-------------------------|
| GPIO        | 12                    | 12                      |
| LED_COUNT   | 1000 (.env)         | ~1000                   |
| BRIGHTNESS  | 128                   | 128                     |
| ORDER       | GRB                   | GRB                     |

- Konfiguration liegt in data/led-groups.json (via /api/led-groups).
- Scheduler setzt den Modus automatisch anhand des Kalenders (Modul 1 → „An“, Modul 2 → „Automatisch“).
- Lagerfeuer-/Szenario-Logik muss noch ausgebaut werden; GPIO für Pumpe/Buttons folgt.
- LED-Order kann bei Bedarf über LED_ORDER (z. B. GRB, RGB, BGR) in der .env angepasst werden.

## UI‑Verhalten / Lagerfeuer

- Beim aktuellen Stand sind die UI‑Verbesserungen in `public/js/led-groups.js` so, dass Gruppen beim ersten Laden eingeklappt sind. Das verbessert die Usability, wenn viele Gruppen existieren.
- Lagerfeuer‑Szenarien werden als zeitbasierte Einträge gehandhabt und enthalten keine per‑LED Einzelzuweisungen mehr. Die Save/Load Logik wurde angepasst, damit Lagerfeuer‑Szenarien nicht versehentlich LED‑Selection‑Felder erwarten.

Siehe `public/led-groups.html` und `public/js/led-groups.js` für aktuelle Implementierungsdetails.
