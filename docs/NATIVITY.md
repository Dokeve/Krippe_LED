Entscheidung: nativity läuft als root
====================================

Kurz: `nativity` wurde bewusst als `root` belassen, um Kompatibilitäts- und Berechtigungsprobleme mit Hardwarezugriff (z. B. `pigpiod`, `/dev/gpiomem`, native Addons) zu vermeiden.

Gründe
- Einfacherer Zugriff auf Low-Level-Hardware ohne umfangreiche Service-Overrides.
- Minimale Änderungen während der laufenden Fehlersuche (GPIO-/pigpiod-Initprobleme).

Empfohlene Gegenmaßnahmen
- Audit: Prüfe eingesetzte Node-Module und entferne unnötige native Addons.
- Netzwerkbegrenzung: Falls möglich, schränke Netzwerkzugriffe mittels systemd-Optionen (`IPAddressDeny=`, `PrivateNetwork=`) oder iptables/nftables ein.
- Capabilities: Verwende `CapabilityBoundingSet=` in der systemd-Unit, um die zur Verfügung stehenden Linux‑Capabilities zu reduzieren.
- Laufzeituser: Falls später gewünscht, kann die Unit angepasst werden, um `nativity` als `singer` auszuführen und stattdessen die benötigten Geräteberechtigungen (z. B. via tmpfiles oder ExecStartPost chown/chmod) zu setzen.
- Updates: Halte System und npm-Abhängigkeiten aktuell; nutze `npm audit`.

Wie weiter
- Wenn du willst, passe ich die `nativity`-Unit an, um als nicht-privilegierter Benutzer zu laufen und die Geräteberechtigungen dauerhaft zu regeln.
- Alternativ kann ich ein kurzes Skript zum Einstellen von Capabilities/Berechtigungen erstellen und testen.
