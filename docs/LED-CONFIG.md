# LED-CONFIG (ALT-WS281x)

| Parameter        | Aktueller Wert        | Soll laut Anforderungen |
|------------------|-----------------------|-------------------------|
| GPIO             | 12                    | 12 (konform)            |
| LED_COUNT        | 200 (`.env`/`config`) | ~1000 (Anpassung offen) |
| BRIGHTNESS       | 128                   | 128 (anpassbar)         |
| COLOR_ORDER      | GRB                   | GRB                     |

- Konfiguration liegt in `data/led-groups.json` (via `/api/led-groups`).
- Scheduler setzt Modus automatisch anhand Kalender (`Modul 1` → an, `Modul 2` → auto).
- Lagerfeuer-/Szenario-Logik in `led-controll` noch rudimentär – Umsetzung laut `Grundlagen.txt` ausstehend.
- MariaDB-Anbindung und Echtfarben-Feintuning stehen noch aus.
