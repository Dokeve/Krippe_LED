# LED-CONFIG (ALT-WS281x)

| Parameter        | Aktueller Wert        | Soll laut Anforderungen |
|------------------|-----------------------|-------------------------|
| GPIO             | 12                    | 12 (konform)            |
| LED_COUNT        | 200 (`.env`/`config`) | ~1000 (Anpassung offen) |
| BRIGHTNESS       | 128                   | 128 (anpassbar)         |
| COLOR_ORDER      | GRB                   | GRB                     |

Hinweise:
- `services/ws2812.js` sowie `config.js`/`.env` setzen derzeit nur 200 LEDs – erhöhen, sobald Scheduler & Versorgung abgestimmt sind.
- Scheduler-Anbindung für Szenarien (Tag, Tag→Nacht, Nacht, Nacht→Tag) fehlt noch.
- Lagerfeuer-/Untergruppenlogik muss über separate Datenstrukturen (DB) ergänzt werden.
