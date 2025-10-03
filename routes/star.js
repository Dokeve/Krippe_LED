// routes/star.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import { Router } from 'express';
import * as store from '../services/star-store.js';

const router = Router();

// Status/Config lesen
router.get('/', async (_req, res) => {
  try {
    const cfg = await store.get();
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Config setzen (berechnet automatisch die Geschwindigkeit)
router.put('/', async (req, res) => {
  try {
    const cfg = await store.set(req.body || {});
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
