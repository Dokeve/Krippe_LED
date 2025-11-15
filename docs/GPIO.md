# GPIO / Hardware I/O (Kurzanleitung)

Dieses Dokument fasst die aktuelle, empfohlene GPIO‑Konfiguration für das Projekt zusammen und erklärt, wie du Hardware‑Pins testest und pigpiod prüfst.

Wichtiges Konzept
- Wir verwenden BCM‑Nummerierung (Broadcom GPIO), nicht physische Pin‑Nummern.
- Die Hauptimplementierung nutzt `pigpio` (Node native binding) und erwartet, dass der Daemon `pigpiod` läuft.
- Für Tests und Debugging solltest du die in der Datei `.env` gesetzten Werte benutzen: `AUDIO_BUTTON_GPIO` und `PUMP_GPIO`.
- Der `PULL`-Wert (UP oder DOWN) gibt an, wie der Taster verschaltet ist und beeinflusst, bei welchem logischen Pegel der Tastendruck erkannt wird.

Wichtige Umgebungsvariablen (in `.env` setzen)
- `AUDIO_BUTTON_GPIO` — BCM‑Pin der Audiodrucktaste (z. B. `5` oder `17`).
- `PUMP_GPIO` — BCM‑Pin für Relais/Pumpe.
- `PUMP_ACTIVE_HIGH` — `1` oder `0`, steuert Relais‑Polarity (default: `1`).
- `PULL` — `UP` oder `DOWN` (default: `DOWN`). Wenn `PULL=UP`, ist der Taster wahrscheinlich gegen GND geschaltet und der "pressed"‑Level ist physisch `0`.

Wie das Code‑Verhalten jetzt ist
- `services/gpio.js` verwendet `pigpio` (sofern verfügbar) und liest `process.env.PULL`.
- Der Code berechnet intern `pressedLevel` auf Basis von `PULL`:
  - `PULL=UP` -> `pressedLevel = 0`
  - `PULL=DOWN` -> `pressedLevel = 1`
- Der registrierte Audio‑Callback wird ausgelöst, wenn ein Alert mit genau diesem Level empfangen wird.

pigpiod prüfen
1) Status prüfen
```bash
sudo systemctl status pigpiod
```
- Sollte `active (running)` zeigen.

2) `pigs` CLI zum schnellen Testen
```bash
# aktuelle Logikpegel lesen (BCM nummer):
sudo pigs r 5
```
- Gibt `0` oder `1` zurück; wiederhole während du den Knopf drückst.

3) PID/Socket prüfen
```bash
ls -l /var/run/pigpio.pid
ls -l /var/run/pigpio.sock 2>/dev/null || true
# pigpiod hat manchmal stattdessen character devices open: prüfe fds mit:
sudo ls -l /proc/$(cat /var/run/pigpio.pid)/fd 2>/dev/null || true
```

Wenn `pigpio` in Node Probleme bei `gpioInitialise` meldet
- Prüfe, ob der Prozess `pigpiod` läuft (siehe oben).
- Prüfe, ob die PID‑Datei existiert und ob `pigs r <pin>` funktioniert.
- Prüfe die Berechtigungen; üblicherweise benötigt Node keine Root‑Rechte, wenn `pigpiod` läuft.
- Wenn du `sudo` für `node` verwendest, achte darauf, Umgebungsvariablen mit `--preserve-env` zu behalten, z. B.:
```bash
sudo --preserve-env=BUTTON_PIN,PULL node server.js
```

Sysfs / libgpiod Hinweise
- Manche Raspberry Pi Distributionen deprecaten den alten sysfs GPIO Pfad (`/sys/class/gpio`). Das Projekt nutzt primär `pigpio`.
- Falls sysfs erforderlich ist, installiere `gpiod` Tools (`sudo apt install gpiod`) und nutze `gpioinfo` / `gpiodetect`.

Debugging‑Weg (Kurzfolge)
1) Sicherstellen, dass `.env` die korrekten BCM‑Nummern enthält (`AUDIO_BUTTON_GPIO`, `PUMP_GPIO`) und `PULL` gesetzt ist.
2) `sudo systemctl status pigpiod` prüfen.
3) `sudo pigs r <AUDIO_BUTTON_GPIO>` ausführen und Pegel beim Drücken beobachten.
4) Falls `pigs` funktioniert, aber Node nicht initialisiert, gib mir die `systemctl status` Ausgabe und die `pigs` Werte — ich helfe bei den nächsten Schritten.

Änderungsvermerk
- Wir haben die einzelnen Test‑Skripte entfernt, um Verwirrung zu vermeiden. Stattdessen dokumentieren wir den einheitlichen Weg über `pigpio` und `pigs`.

Wenn du möchtest, erstelle ich später ein einzelnes, kleines Diagnose‑Script `scripts/gpio-diagnose.sh`, das diese Prüfungen automatisiert und die wichtigsten Ausgaben sammelt.
