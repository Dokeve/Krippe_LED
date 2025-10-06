// config.js — zentrale Konfiguration (ESM, Node ≥ 20)
import { fileURLToPath } from 'node:url';
import path, { join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// .env laden (optional, ohne harte Abhängigkeit)
try {
  const { default: dotenv } = await import('dotenv');
  const envFile = join(__dirname, '.env');
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
} catch { /* kein dotenv installiert → ignorieren */ }

const toInt   = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const truthy  = (v, d=true) => {
  if (v == null) return d;
  const s = String(v).trim().toLowerCase();
  return ['1','true','yes','on'].includes(s);
};

const rootDir = __dirname;

// ==== Vorgaben aus deinem bisherigen config.js ====
const DEFAULT_CYCLE_SECONDS = {
  total:   toInt(process.env.CYCLE_TOTAL   ?? undefined, 300),
  day:     toInt(process.env.CYCLE_DAY     ?? undefined, 100),
  dayNight:toInt(process.env.CYCLE_DAYNIGHT?? undefined, 50),
  night:   toInt(process.env.CYCLE_NIGHT   ?? undefined, 100),
  nightDay:toInt(process.env.CYCLE_NIGHTDAY?? undefined, 50)
};

// Audio-Verzeichnisse (überschreibbar via .env)
const DEFAULT_AUDIO_SPEECH = process.env.AUDIO_SPEECH_DIR
  || '/home/singer/led-sound-bachlauf/audio/krippe/Audioprachdateien';
const DEFAULT_AUDIO_BGM = process.env.AUDIO_BGM_DIR
  || '/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik';

// Gemeinsames Audio-Root: .env > explizit > Ableitung
const DEFAULT_AUDIO_ROOT =
  process.env.AUDIO_DIR
  || (DEFAULT_AUDIO_SPEECH.startsWith('/home') || DEFAULT_AUDIO_BGM.startsWith('/home')
      ? '/home/singer/led-sound-bachlauf/audio'
      : join(rootDir, 'audio'));

// GPIO-Defaults (können von DB/Settings oder .env überschrieben werden)
const GPIO_DEFAULTS = {
  ws2812Primary: toInt(process.env.LED_GPIO_PRIMARY ?? undefined, 18),
  ws2812Alt:     toInt(process.env.LED_GPIO_ALT     ?? undefined, 12),
  pump:          toInt(process.env.PUMP_GPIO        ?? undefined, 19),
  audioButton:   toInt(process.env.AUDIO_BUTTON_GPIO?? undefined, 13)
};

// ==== Pfade ====
const paths = {
  root:    rootDir,
  public:  process.env.PUBLIC_DIR || join(rootDir, 'public'),
  db:      process.env.DB_DIR     || join(rootDir, 'db'),
  data:    process.env.DATA_DIR   || join(rootDir, 'data'),
  // Audio: Root + Unterordner (für Abwärtskompatibilität bleibt audioRoot erhalten)
  audioRoot:  DEFAULT_AUDIO_ROOT,
  audioSpeech:DEFAULT_AUDIO_SPEECH,
  audioBgm:   DEFAULT_AUDIO_BGM
};

// ==== DB-Schalter ====
const useFileDb = truthy(process.env.USE_FILE_DB ?? '1');
const db = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'krippe',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'krippe',
};

// ==== LED-Konfiguration ====
// Standard entspricht Projektvorgabe: ALT/rpi-ws281x, GRB, GPIO 12
const led = {
  lib:        (process.env.LED_LIB || 'alt').toLowerCase(),   // alt | native
  gpio:       toInt(process.env.LED_GPIO, GPIO_DEFAULTS.ws2812Alt), // default 12
  gpioPrimary:GPIO_DEFAULTS.ws2812Primary, // 18 (z. B. falls native genutzt wird)
  brightness: toInt(process.env.LED_BRIGHTNESS, 128),
  count:      toInt(process.env.LED_COUNT, 200),
  order:      'GRB'
};

// ==== Scheduler / Zyklen ====
const scheduler = {
  cycleSeconds: DEFAULT_CYCLE_SECONDS,  // {total, day, dayNight, night, nightDay}
};

// ==== Logging (morgan) ====
const logging = {
  morganEnabled: (process.env.MORGAN_ENABLED ?? '1') !== '0',
  morganFormat:   process.env.MORGAN_FORMAT || (process.env.NODE_ENV === 'production' ? 'combined' : 'dev'),
  morganToFile:  (process.env.MORGAN_TO_FILE ?? '0') === '1',
  morganFilePath: process.env.MORGAN_FILE_PATH || join(paths.root, 'logs', 'access.log'),
  skipHealth:    (process.env.MORGAN_SKIP_HEALTH ?? '1') === '1'
};

// ==== GPIO zusammengefasst (für Pumpe/Buttons) ====
const gpio = {
  pump:        GPIO_DEFAULTS.pump,        // default 19
  audioButton: GPIO_DEFAULTS.audioButton, // default 13
};

const cfg = {
  env:   process.env.NODE_ENV || 'development',
  port:  toInt(process.env.PORT, 3000),
  useFileDb,
  db,
  led,
  gpio,
  scheduler,
  paths,
  logging
};

export default cfg;
