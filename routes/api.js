// routes/api.js
import { Router } from 'express';

const router = Router();

// Einfache In-Memory-Persistenz; später auf db/star-store umbiegen
let modeState = { mode: 'idle' };

/**
 * GET /api/mode
 * Liefert den aktuellen Modus.
 * Antwort: { mode: string }
 */
router.get('/mode', (_req, res) => {
  res.json(modeState);
});

/**
 * POST /api/mode
 * Setzt den Modus.
 * Body (JSON): { mode: string }
 * Antwort: { mode: string }
 */
router.post('/mode', (req, res) => {
  const { mode } = req.body || {};
  if (typeof mode !== 'string' || !mode.trim()) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  modeState = { mode: mode.trim() };
  res.json(modeState);
});

export default router;
