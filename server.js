// server.js — Rahmenserver für Krippe_LED (ESM, Node = 20)
// Lädt Router aus ./routes automatisch, liefert Health, startet optional scheduler.
// Erwartete Routen-Dateien (wenn vorhanden): health.js, audio.js, calendar.js, led-groups.js, star.js

import express from 'express';
import http from 'node:http';
import path, { join } from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import config from './config.js';

// NEU: morgan robust importieren (ESM/CJS sicher)
import morgan from 'morgan';
// [optional] kleines Hilfsding, falls du kein ensureDir hast:
const ensureDirSync = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

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

// >>> NEU: morgan-Middleware einhängen
if (config.logging?.morganEnabled) {
  const skip = (req, _res) =>
    config.logging.skipHealth && (req.path === '/health' || req.path.startsWith('/api/health'));

  if (config.logging.morganToFile) {
    ensureDirSync(path.dirname(config.logging.morganFilePath));
    const stream = fs.createWriteStream(config.logging.morganFilePath, { flags: 'a' });
    app.use(morgan(config.logging.morganFormat, { stream, skip }));
    console.log(`[morgan] to file: ${config.logging.morganFilePath} (${config.logging.morganFormat})`);
  } else {
    // ins Journal (stdout) – systemd/journald fängt es ab
    app.use(morgan(config.logging.morganFormat, { skip }));
    console.log(`[morgan] to journal (${config.logging.morganFormat})`);
  }
}
// Static (Frontend)
if (fs.existsSync(config.paths.public)) {
  app.use(express.static(config.paths.public));
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
  { file: 'star.js',       base: '/api/star' },
  { file: 'files.js',      base: '/api/list-files' }
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
      console.warn(`[router] routes/${file} exportiert keinen Router (default/function). übersprungen.`);
    }
  } else {
    console.warn(`[router] fehlt: routes/${file} (base ${base}) – wird nicht gemountet.`);
  }
}

// 404 für /api/*
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Fallback 404 für alles andere
app.use((req, res) => {
  res.status(404).send('Krippe Webserver: Seite nicht gefunden.');
});

// Optional: Scheduler starten, falls vorhanden (start() wird aufgerufen, wenn exportiert)
try {
  const schedPath = join(__dirname, 'services', 'scheduler.js');
  if (fs.existsSync(schedPath)) {
    const schedMod = await import(pathToFileURL(schedPath).href);
    const startFn = schedMod.start ?? schedMod.startScheduler ?? schedMod.default?.start;
    if (typeof startFn === 'function') {
      await startFn({ app, config });
      console.log('[scheduler] gestartet');
    } else {
      console.log('[scheduler] gefunden, aber keine start()-Funktion exportiert – übersprungen');
    }
  }
} catch (e) {
  console.warn('[scheduler] Start fehlgeschlagen:', e.message);
}

// Start
const server = http.createServer(app);
server.listen(config.port, () => {
  console.log(`Server läuft auf http://localhost:${config.port}`);
});

// Robustheit
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

// Optional für Tests
export default app;




