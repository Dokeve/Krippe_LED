-- /home/singer/krippe_neu_2025/led-sound-bachlauf/migrations/001_init.sql
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Einstellungen/Key-Value
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  k VARCHAR(64) NOT NULL UNIQUE,
  v TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Hauptgruppen (Adventszeit / Weihnachtszeit)
CREATE TABLE IF NOT EXISTS led_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,           -- "Adventszeit" / "Weihnachtszeit" / "Lagerfeuer"
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Untergruppen
CREATE TABLE IF NOT EXISTS led_subgroups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  label VARCHAR(128) NOT NULL,         -- Bezeichnung
  led_from INT NOT NULL,               -- LED von
  led_to INT NOT NULL,                 -- LED bis (inklusiv)
  led_count INT NOT NULL,              -- Anzahl LED
  wall_light TINYINT(1) NOT NULL DEFAULT 0,
  color_day VARCHAR(7) NULL,           -- "#RRGGBB"
  color_night VARCHAR(7) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subgroup_group FOREIGN KEY (group_id) REFERENCES led_groups(id) ON DELETE CASCADE,
  INDEX (group_id)
) ENGINE=InnoDB;

-- Szenario-Typen (fixe 4)
CREATE TABLE IF NOT EXISTS scenario_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code ENUM('DAY','DAY_NIGHT','NIGHT','NIGHT_DAY') NOT NULL UNIQUE,
  label VARCHAR(64) NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO scenario_types (id, code, label) VALUES
  (1,'DAY','Tag'),
  (2,'DAY_NIGHT','Tag-Nacht'),
  (3,'NIGHT','Nacht'),
  (4,'NIGHT_DAY','Nacht-Tag');

-- Pro Untergruppe: optionale Szenario-Zeitfenster (Sekunden relativ innerhalb des Szenarios)
CREATE TABLE IF NOT EXISTS subgroup_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subgroup_id INT NOT NULL,
  scenario_id INT NOT NULL,            -- FK auf scenario_types
  start_sec INT NULL,                  -- z.B. 10
  end_sec INT NULL,                    -- z.B. 60
  led_selection VARCHAR(1024) NULL,    -- z.B. "1-5,10,12,13-15"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sched_subgroup FOREIGN KEY (subgroup_id) REFERENCES led_subgroups(id) ON DELETE CASCADE,
  CONSTRAINT fk_sched_scenario FOREIGN KEY (scenario_id) REFERENCES scenario_types(id) ON DELETE RESTRICT,
  INDEX (subgroup_id), INDEX (scenario_id)
) ENGINE=InnoDB;

-- Lagerfeuer-Konfiguration (als eigene Tabelle, 5 Farben)
CREATE TABLE IF NOT EXISTS campfire_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,               -- Verweis auf die "Lagerfeuer"-Gruppe
  led_from INT NOT NULL,
  led_to INT NOT NULL,
  color1 VARCHAR(7) NOT NULL,
  color2 VARCHAR(7) NOT NULL,
  color3 VARCHAR(7) NOT NULL,
  color4 VARCHAR(7) NOT NULL,
  color5 VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_camp_group FOREIGN KEY (group_id) REFERENCES led_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Kalender (FullCalendar-Einträge)
CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  module ENUM('MODULE1','MODULE2') NOT NULL,
  start_dt DATETIME NOT NULL,
  end_dt DATETIME NOT NULL,
  is_recurring_weekly TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (module), INDEX (start_dt), INDEX (end_dt)
) ENGINE=InnoDB;

-- Audio Sprachdateien mit Zeitraum
CREATE TABLE IF NOT EXISTS audio_speech (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_path VARCHAR(512) NOT NULL,     -- /home/singer/.../Audioprachdateien/<file>.mp3
  start_dt DATETIME NULL,
  end_dt DATETIME NULL,
  gpio_pin INT NULL,                   -- Trigger-Pin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (start_dt), INDEX (end_dt)
) ENGINE=InnoDB;

-- Hintergrundmusik je Szenario (Dropdown-Zuweisung)
CREATE TABLE IF NOT EXISTS audio_bgm (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scenario_id INT NOT NULL,            -- 1..4
  file_path VARCHAR(512) NOT NULL,     -- /home/singer/.../Hintergrundmusik/<file>.mp3
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bgm_scenario FOREIGN KEY (scenario_id) REFERENCES scenario_types(id) ON DELETE RESTRICT,
  UNIQUE KEY uniq_scenario (scenario_id)
) ENGINE=InnoDB;

-- LED Overrides: explizite Einzel-LED-Farben (optional)
CREATE TABLE IF NOT EXISTS led_overrides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  led_index INT NOT NULL,
  color VARCHAR(7) NOT NULL,           -- "#RRGGBB"
  scenario_id INT NULL,                -- optional: nur in bestimmtem Szenario
  duration_ms INT NULL,                -- optional: Dauer der Überschreibung
  INDEX (led_index)
) ENGINE=InnoDB;

-- Bachlauf Status-Flag
CREATE TABLE IF NOT EXISTS pump_state (
  id INT PRIMARY KEY CHECK (id=1),
  active TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO pump_state (id, active) VALUES (1,0);

-- Grundwerte
INSERT IGNORE INTO settings (k, v) VALUES
 ('led.count','1000'),
 ('gpio.ws2812.primary','18'),
 ('gpio.ws2812.alt','12'),
 ('gpio.pump','19'),
 ('gpio.audio.button','13'),
 ('module2.cycle.seconds','300'),
 ('module2.phase.day','100'),
 ('module2.phase.day_night','50'),
 ('module2.phase.night','100'),
 ('module2.phase.night_day','50');
