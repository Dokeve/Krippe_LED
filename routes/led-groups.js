// routes/led-groups.js
import { Router } from 'express';
import { getLedConfig, saveLedConfig } from '../services/led-store.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json(getLedConfig());
  } catch (e) {
    res.status(500).json({ error: 'Failed to load LED groups', detail: e?.message || String(e) });
  }
});

router.put('/', (req, res) => {
  try {
    const saved = saveLedConfig(req.body || {});
    res.json({ ok: true, config: saved });
  } catch (e) {
    res.status(400).json({ error: 'Failed to save LED groups', detail: e?.message || String(e) });
  }
});

export default router;
