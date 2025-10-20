// server.js - Rahmenserver f?r Krippe_LED (ESM, Node = 20)
// L?dt Router aus ./routes automatisch, liefert Health, startet optional scheduler.
// Erwartete Routen-Dateien (wenn vorhanden): health.js, audio.js, calendar.js, led-groups.js, star.js

import express from 'express';
import http from 'node:http';
import path, { join } from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import config from './config.js';
import { initGpio, onAudioButton } from './services/gpio.js';
import { triggerSpeech } from './services/audio-scenario.js';

// NEU: morgan robust importieren (ESM/CJS sicher)
import morgan from 'morgan';
// [optional] kleines Hilfsding, falls du kein ensureDir hast:
const ensureDirSync = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// Debug: print important runtime config so we can verify .env values are loaded
try {
  console.log('[config] env:', config.env);
  console.log('[config] port:', config.port);
  console.log('[config] scheduler.cycleSeconds:', JSON.stringify(config.scheduler?.cycleSeconds));
  console.log('[config] audio.device:', config.audio?.outputDevice);
  console.log('[config] audio.paths:', config.paths?.audioRoot, config.paths?.audioBgm, config.paths?.audioSpeech);
} catch (e) {
  // ignore
}
// diagnostic: print whether .env file exists and raw env value for CYCLE_DAY
try {
  const envFilePath = join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  console.log('[env-check] envFileExists:', fs.existsSync(envFilePath), 'envFilePath:', envFilePath);
  console.log('[env-check] process.env.CYCLE_DAY:', process.env.CYCLE_DAY);
} catch (e) {}

// CORS light
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Bodyparser
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// >>> NEU: morgan-Middleware einh?ngen
if (config.logging?.morganEnabled) {
  const skip = (req, _res) =>
    config.logging.skipHealth && (req.path === '/health' || req.path.startsWith('/api/health'));

  if (config.logging.morganToFile) {
    ensureDirSync(path.dirname(config.logging.morganFilePath));
    const stream = fs.createWriteStream(config.logging.morganFilePath, { flags: 'a' });
    app.use(morgan(config.logging.morganFormat, { stream, skip }));
    console.log(`[morgan] to file: ${config.logging.morganFilePath} (${config.logging.morganFormat})`);
  } else {
    // ins Journal (stdout) - systemd/journald f?ngt es ab
    app.use(morgan(config.logging.morganFormat, { skip }));
    console.log(`[morgan] to journal (${config.logging.morganFormat})`);
  }
}
// Static (Frontend)
if (fs.existsSync(config.paths.public)) {
  app.use(express.static(config.paths.public, {
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
  }));
}

// Immer da: schlanker Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: config.env, time: new Date().toISOString() });
});

// Erweiterter API-Health (leichtgewichtig, ohne DB-Ping)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    env: config.env,
    time: new Date().toISOString(),
    db: { mode: config.useFileDb ? 'file' : 'mariadb' },
    audio: { dir: config.paths.audio, exists: fs.existsSync(config.paths.audio) },
    led: config.led
  });
});

// Dynamisches Mounten aller bekannten Router, wenn die Datei existiert
const expectedRouters = [
  { file: 'health.js',     base: '/api/health' },       // optional eigener Health-Router
  { file: 'audio.js',      base: '/api/audio' },
  { file: 'calendar.js',   base: '/api/calendar' },
  { file: 'led-groups.js', base: '/api/led-groups' },
  { file: 'mode.js',       base: '/api/mode' },
  { file: 'status.js',     base: '/api/status' },
  { file: 'star.js',       base: '/api/star' },
  { file: 'files.js',      base: '/api/list-files' }
  ,{ file: 'bachlauf.js',  base: '/api/bachlauf' }
];

for (const { file, base } of expectedRouters) {
  const abs = join(__dirname, 'routes', file);
  if (fs.existsSync(abs)) {
    const mod = await import(pathToFileURL(abs).href);
    const router = mod.default ?? mod.router ?? mod;
    if (typeof router === 'function') {
      app.use(base, router);
      console.log(`[router] mounted ${base} -> routes/${file}`);
    } else {
      console.warn(`[router] routes/${file} exportiert keinen Router (default/function). ?bersprungen.`);
    }
  } else {
    console.warn(`[router] fehlt: routes/${file} (base ${base}) - wird nicht gemountet.`);
  }
}

// 404 f?r /api/*
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Fallback 404 f?r alles andere
app.use((req, res) => {
  res.status(404).send('Krippe Webserver: Seite nicht gefunden.');
});

let schedulerModule = null;

// Optional: Scheduler starten, falls vorhanden (start() wird aufgerufen, wenn exportiert)
try {
  const schedPath = join(__dirname, 'services', 'scheduler.js');
  if (fs.existsSync(schedPath)) {
    const schedMod = await import(pathToFileURL(schedPath).href);
    schedulerModule = schedMod;
    const startFn = schedMod.start ?? schedMod.startScheduler ?? schedMod.default?.start;
    if (typeof startFn === 'function') {
      await startFn({ app, config });
      console.log('[scheduler] gestartet');
    } else {
      console.log('[scheduler] gefunden, aber keine start()-Funktion exportiert - ?bersprungen');
    }
  }
} catch (e) {
  console.warn('[scheduler] Start fehlgeschlagen:', e.message);
}

try {
  await initGpio();
  // init bachlauf service if present
  try {
    const bachlaufPath = join(__dirname, 'services', 'bachlauf.js');
    if (fs.existsSync(bachlaufPath)) {
      const b = await import(pathToFileURL(bachlaufPath).href);
      const svc = b.default ?? b;
      if (typeof svc.init === 'function') {
        svc.init();
        console.log('[bachlauf] service initialized');
      }
    }
  } catch (e) { console.warn('[bachlauf] init failed', e?.message || e); }
  onAudioButton(async () => {
    const lastModule = schedulerModule?.getLastModule?.() ?? null;
    if (lastModule !== '2') {
      console.log('[GPIO] Audio-Button ignoriert (Modul', lastModule ?? 'none', ')');
      return;
    }
    const triggered = await triggerSpeech();
    console.log(triggered ? '[Audio] Sprachdatei per Button ausgelöst' : '[Audio] Button ohne aktive Sprachdatei');
  });
} catch (error) {
  console.warn('[GPIO] Initialisierung fehlgeschlagen:', error?.message || error);
}

// Start
const server = http.createServer(app);
server.listen(config.port, () => {
  console.log(`Server läuft auf http://localhost:${config.port}`);
});

// Robustheit
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

// Optional f?r Tests
export default app;



