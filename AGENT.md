# AGENT.md — Weboberfläche Krippe (aktualisiert am 2025-10-03)

**Mission:** Web-UI + Dienst zur Steuerung der Krippe (LED-Bachlauf, Audio, Kalender/Scheduler, Sternsteuerung) auf dem Raspberry Pi.  
**Service-Name (systemd):** `nativity.service`

---

## Ground Truth (Stand 2025-10-03, Europe/Berlin)

- **Persistenz:** MariaDB als Quelle der Wahrheit (Settings, Kalender/Events, Audio-Listen). Ausnahme: `data/star.json` für Sternsteuerung.  
- **LED:** `rpi-ws281x` (ALT-Variante), **Farbordnung GRB**, **GPIO 12**, Standard-Helligkeit **128/255**; Init genau 1×; GRB-Permutation in LED-Schicht.  
- **Zyklus:** 4 Phasen: *Tag (100 s) → Tag→Nacht (50 s Fader) → Nacht (100 s) → Nacht→Tag (50 s Fader)*; konfigurierbar.  
- **Bachlauf (Pumpe):** Relais **GPIO 19** (active_low), **nicht** an LED-Effekte koppeln.  
- **Audio:** Tag/Nacht-Profile (Loops) + datumsabhängige Sprach-Clips; **Ducking**; GPIO-Button **GPIO 13** triggert Clips.  
- **Kalender/Scheduler:** steuert Audio/LED; FullCalendar-Frontend.  
- **Web-UI (Altstand):** Seiten `index`, `audio`, `calendar`, `led-groups`, `star`, `export`; dunkles Theme; Export/Import.  
- **Service:** systemd-Unit **nativity.service**; Alt-Units (`led-sound-bachlauf.service`, `ledsound.service`) abschalten.  
- **Repo:** GitHub `Dokeve/Krippe_LED`, Branch `develop`; LFS für *.mp3/*.wav.  
- **Offene Punkte:** Speichern (Reload-Verlust), Audioauswahl (Browse/Filter), LED-Zeitfenster (von/bis), **morgan**-HTTP-Logging.

---

## Codex Agent — Projektkennung

- `codex_agent_conversation_id`: **fb935d75e9d12124**  
- Datei: `codex/PROJECT_ID.json`  
- Hinweis: projektinterne ID, nicht die offizielle ChatGPT-Conversation-ID.

---

## Kommandos (Pi)

```bash
cp .env.example .env
npm ci --omit=dev
sudo ./scripts/install_systemd.sh
sudo systemctl status nativity -n 100
```

---

## Dateikarte

- **AGENT.md** (Root) · **README.md** (Root)  
- **docs/** STATE, LED, SYSTEMD, TROUBLESHOOTING, DB, AUDIO, CALENDAR, DECISIONS, TASKS  
- **config/** Defaults · **systemd/nativity.service** · **scripts/** · **.env.example**  
- **codex/PROJECT_ID.json** – ID + Metadaten
