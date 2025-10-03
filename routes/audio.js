// routes/audio.js
import { Router } from 'express';
import { getAudioConfig, saveAudioConfig } from '../services/audio-store.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json(getAudioConfig());
  } catch (e) {
    res.status(500).json({ error: 'Failed to read audio configuration', detail: e?.message || String(e) });
  }
});

router.put('/', (req, res) => {
  try {
    const saved = saveAudioConfig(req.body || {});
    res.json({ ok: true, config: saved });
  } catch (e) {
    res.status(400).json({ error: 'Failed to save audio configuration', detail: e?.message || String(e) });
  }
});

export default router;
