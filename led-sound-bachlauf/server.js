// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';

const app = express();

// Basiskonfiguration
app.disable('x-powered-by');
app.use(express.json());           // JSON-Body
app.use(express.urlencoded({ extended: true })); // ggf. Form-Posts

// Statik (falls du eine Weboberfläche auslieferst)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// API mounten
app.use('/api', apiRouter);

// Healthcheck (optional)
app.get('/health', (_req, res) => res.json({ ok: true }));

// 404-Handler NACH allen Routen
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Fehler-Handler (letzte Middleware)
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
