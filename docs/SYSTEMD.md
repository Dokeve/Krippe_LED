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
