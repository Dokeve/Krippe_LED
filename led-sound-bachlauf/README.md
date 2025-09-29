# LED Sound Bachlauf – Steuerung & Weboberfläche

Dieses Projekt steuert einen LED-Bachlauf mit Audio-Integration über eine Weboberfläche (Node.js + Express + FullCalendar).  
Es unterstützt LED-Gruppen, Audio-Module, einen Kalender für Zeitpläne sowie Export/Import der Konfiguration.

---

## Features

### LED-Steuerung
- Verwaltung von LED-Gruppen und Untergruppen.
- **Individuelle LED-Farben**: Farbauswahl über kompakte Quadrate, direkte Vorschau.
- Speicherung und Wiederherstellung pro LED/Subgruppe.

### Audio
- Modul-basierte Audiosteuerung (getrennte Module, eigene Konfiguration).

### Kalender
- Monats-, Wochen- und Tagesansicht (FullCalendar).
- **Einzeltermine und Serientermine (wöchentlich)** anlegbar.
- Sofortige Anzeige nach dem Speichern (ohne Reload).
- **Löschfunktionen**:  
  - „Nur diesen Termin“  
  - „Ganze Serie“ (alle Wiederholungen)

### Export / Import
- Export aller Konfigurationsdateien (`calendar.json`, `audio.json`, `led-groups.json`).
- **Import-Funktion**: Upload der JSON-Dateien, Prüfung + automatisches Anwenden über die API.

### Oberfläche
- Einheitliches Dark-Blue-Theme.
- Optionales Hintergrundbild (`public/1260222.jpg`).
- Navigation zwischen allen Modulen.

---

## Technische Details

### Backend
- Node.js mit Express.
- API-Endpunkte:
  - `GET /api/calendar` – aktuelle Kalenderdaten
  - `PUT /api/calendar` – gesamte Kalenderdaten ersetzen
  - `POST /api/calendar/save` – Fallback-Speicherung
  - `GET /api/audio`, `PUT /api/audio`
  - `GET /api/led-groups`, `PUT /api/led-groups`
  - `GET /api/health` – Healthcheck
- Datenhaltung: MariaDB oder lokale JSON-Dateien (via `USE_FILE_DB=1`).

### Frontend
- Plain HTML, CSS, JavaScript.
- [FullCalendar](https://fullcalendar.io/) für die Kalenderansicht.
- Responsives Design für Desktop & Mobile.

---

## Installation & Start

### Voraussetzungen
- Raspberry Pi / Linux-Host
- Node.js ≥ 20
- (optional) MariaDB, ansonsten File-DB

### Setup
```bash
# Repository klonen
git clone <repo-url> led-sound-bachlauf
cd led-sound-bachlauf

# Abhängigkeiten installieren
npm install
