import { fileURLToPath } from "node:url";
import path, { join } from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const { default: dotenv } = await import("dotenv");
  const envFile = join(__dirname, ".env");
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
} catch {
  /* dotenv optional */
}

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const toInt = (value, fallback) => {
  const normalized = clean(value);
  return Number.isFinite(Number(normalized)) ? Number(normalized) : fallback;
};
const truthy = (value, fallback = true) => {
  if (value == null) return fallback;
  const normalized = String(clean(value)).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};
const envPath = (key, fallback) => {
  const raw = clean(process.env[key]);
  return raw && raw.length > 0 ? raw : fallback;
};

const rootDir = __dirname;

const DEFAULT_CYCLE_SECONDS = {
  total: toInt(process.env.CYCLE_TOTAL, 300),
  day: toInt(process.env.CYCLE_DAY, 80),
  dayNight: toInt(process.env.CYCLE_DAYNIGHT, 50),
  night: toInt(process.env.CYCLE_NIGHT, 100),
  nightDay: toInt(process.env.CYCLE_NIGHTDAY, 50)
};

const DEFAULT_AUDIO_SPEECH = envPath(
  "AUDIO_SPEECH_DIR",
  "/home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien"
);
const DEFAULT_AUDIO_BGM = envPath(
  "AUDIO_BGM_DIR",
  "/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik"
);
const DEFAULT_AUDIO_ROOT = envPath(
  "AUDIO_DIR",
  DEFAULT_AUDIO_SPEECH.startsWith("/home") || DEFAULT_AUDIO_BGM.startsWith("/home")
    ? "/home/singer/led-sound-bachlauf/audio"
    : join(rootDir, "audio")
);

const audio = {
  outputDevice: clean(process.env.AUDIO_OUTPUT_DEVICE) || "hw:1,0"
};

// optional audio settings
audio.duckPercent = toInt(process.env.AUDIO_DUCK_PERCENT, 30);
audio.debugLogPath = envPath('AUDIO_DEBUG_LOG_PATH', join(rootDir, 'logs', 'audio-debug.log'));

const paths = {
  root: rootDir,
  public: envPath("PUBLIC_DIR", join(rootDir, "public")),
  db: envPath("DB_DIR", join(rootDir, "db")),
  data: envPath("DATA_DIR", join(rootDir, "data")),
  audioRoot: DEFAULT_AUDIO_ROOT,
  audioSpeech: DEFAULT_AUDIO_SPEECH,
  audioBgm: DEFAULT_AUDIO_BGM
};

const useFileDb = truthy(process.env.USE_FILE_DB, true);
const db = {
  host: envPath("DB_HOST", "127.0.0.1"),
  user: envPath("DB_USER", "krippe"),
  password: clean(process.env.DB_PASSWORD) || "",
  database: envPath("DB_DATABASE", "krippe")
};

const led = {
  gpio: toInt(process.env.LED_GPIO, 12),
  brightness: toInt(process.env.LED_BRIGHTNESS, 128),
  count: toInt(process.env.LED_COUNT, 1000),
  order: (clean(process.env.LED_ORDER) || "GRB").toUpperCase()
};

const scheduler = {
  cycleSeconds: DEFAULT_CYCLE_SECONDS
};

const logging = {
  morganEnabled: (clean(process.env.MORGAN_ENABLED) ?? "1") !== "0",
  morganFormat:
    clean(process.env.MORGAN_FORMAT) ||
    (clean(process.env.NODE_ENV) === "production" ? "combined" : "dev"),
  morganToFile: clean(process.env.MORGAN_TO_FILE) === "1",
  morganFilePath: envPath("MORGAN_FILE_PATH", join(paths.root, "logs", "access.log")),
  skipHealth: clean(process.env.MORGAN_SKIP_HEALTH) !== "0"
};

const gpio = {
  pump: toInt(process.env.PUMP_GPIO, 19),
  audioButton: toInt(process.env.AUDIO_BUTTON_GPIO, 17)
};

const cfg = {
  env: clean(process.env.NODE_ENV) || "development",
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

