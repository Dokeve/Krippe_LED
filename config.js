// config.js – zentrale Konfiguration (ESM, Node = 20)
import { fileURLToPath } from 'node:url';
import path, { join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const { default: dotenv } = await import('dotenv');
  const envFile = join(__dirname, '.env');
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
} catch {
  /* dotenv optional */
}

const toInt = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const truthy = (value, fallback = true) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const rootDir = __dirname;

const DEFAULT_CYCLE_SECONDS = {
  total: toInt(process.env.CYCLE_TOTAL ?? undefined, 300),
  day: toInt(process.env.CYCLE_DAY ?? undefined, 80),
  dayNight: toInt(process.env.CYCLE_DAYNIGHT ?? undefined, 50),
  night: toInt(process.env.CYCLE_NIGHT ?? undefined, 100),
  nightDay: toInt(process.env.CYCLE_NIGHTDAY ?? undefined, 50)
};

const DEFAULT_AUDIO_SPEECH = process.env.AUDIO_SPEECH_DIR
  || '/home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien';
const DEFAULT_AUDIO_BGM = process.env.AUDIO_BGM_DIR
  || '/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik';

const DEFAULT_AUDIO_ROOT = process.env.AUDIO_DIR
  || (DEFAULT_AUDIO_SPEECH.startsWith('/home') || DEFAULT_AUDIO_BGM.startsWith('/home')
    ? '/home/singer/led-sound-bachlauf/audio'
    : join(rootDir, 'audio'));

const audio = {
  outputDevice: process.env.AUDIO_OUTPUT_DEVICE || ''
};

const paths = {
  root: rootDir,
  public: process.env.PUBLIC_DIR || join(rootDir, 'public'),
  db: process.env.DB_DIR || join(rootDir, 'db'),
  data: process.env.DATA_DIR || join(rootDir, 'data'),
  audioRoot: DEFAULT_AUDIO_ROOT,
  audioSpeech: DEFAULT_AUDIO_SPEECH,
  audioBgm: DEFAULT_AUDIO_BGM
};

const useFileDb = truthy(process.env.USE_FILE_DB ?? '1');
const db = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'krippe',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'krippe'
};

const led = {
  gpio: toInt(process.env.LED_GPIO ?? undefined, 12),
  brightness: toInt(process.env.LED_BRIGHTNESS ?? undefined, 128),
  count: toInt(process.env.LED_COUNT ?? undefined, 1000),
  order: (process.env.LED_ORDER || 'GRB').toUpperCase()
};

const scheduler = {
  cycleSeconds: DEFAULT_CYCLE_SECONDS
};

const logging = {
  morganEnabled: (process.env.MORGAN_ENABLED ?? '1') !== '0',
  morganFormat: process.env.MORGAN_FORMAT || (process.env.NODE_ENV === 'production' ? 'combined' : 'dev'),
  morganToFile: (process.env.MORGAN_TO_FILE ?? '0') === '1',
  morganFilePath: process.env.MORGAN_FILE_PATH || join(paths.root, 'logs', 'access.log'),
  skipHealth: (process.env.MORGAN_SKIP_HEALTH ?? '1') === '1'
};

const gpio = {
  pump: toInt(process.env.PUMP_GPIO ?? undefined, 19),
  audioButton: toInt(process.env.AUDIO_BUTTON_GPIO ?? undefined, 17)
};

const cfg = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  useFileDb,
  db,
  led,
  gpio,
  scheduler,
  audio,
  paths,
  logging
};

export default cfg;
