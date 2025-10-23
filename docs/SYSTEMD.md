# SYSTEMD — nativity.service

## Installation
```bash
sudo cp systemd/nativity.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nativity
sudo systemctl status nativity -n 100
```

## Migration (Alt-Units)
```bash
sudo systemctl disable --now led-sound-bachlauf.service 2>/dev/null || true
sudo systemctl disable --now ledsound.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/led-sound-bachlauf.service /etc/systemd/system/ledsound.service
sudo systemctl daemon-reload
```

## Hinweise zur nativity.service im Repo

- Die im Repository vorhandene Datei `systemd/nativity.service` wurde angepasst (Umgebungsvariablen, Node‑Startpfad, Restart‑Policy). Damit die Änderungen aktiv werden, führe auf dem Pi aus:
	```bash
	sudo cp systemd/nativity.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable --now nativity
	sudo journalctl -u nativity -n 200 --no-pager
	```

Beachte: Änderungen an der Repo‑Kopie der Unit werden nicht automatisch auf dem Pi angewendet; obige Schritte sind nötig.
