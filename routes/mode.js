// routes/mode.js
// REST-API für den LED-Modus (an/aus/auto)
import { Router } from 'express';
import { getMode as readMode, saveMode } from '../services/mode-store.js';
import * as ledControll from '../services/led-controll.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json({ mode: readMode() });
  } catch (error) {
    res.status(500).json({ error: 'Modus konnte nicht gelesen werden', detail: error?.message || String(error) });
  }
});

router.post('/', async (req, res) => {
  try {
    const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim().toLowerCase() : 'auto';
    if (!['on', 'off', 'auto'].includes(mode)) {
      return res.status(400).json({ error: 'Ungültiger Modus', allowed: ['on', 'off', 'auto'] });
    }

    const persisted = saveMode(mode);
    ledControll.setMode(persisted);
    await ledControll.apply();

    res.json({ mode: persisted });
  } catch (error) {
    res.status(500).json({ error: 'Modus konnte nicht gesetzt werden', detail: error?.message || String(error) });
  }
});

export default router;
