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
