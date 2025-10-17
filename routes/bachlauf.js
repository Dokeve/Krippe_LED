import { Router } from 'express';
import bachlauf from '../services/bachlauf.js';

const router = Router();

router.post('/start', (req, res) => {
  try {
    const raw = req.body?.duration;
    const duration = raw != null ? Number(raw) : undefined;
    if (raw != null && (!Number.isFinite(duration) || duration <= 0)) return res.status(400).json({ ok: false, error: 'Invalid duration' });
    const result = bachlauf.startPump(duration);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post('/stop', (_req, res) => {
  try {
    const result = bachlauf.stopPump();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.get('/status', (_req, res) => {
  try {
    const st = bachlauf.getStatus();
    res.json({ ok: true, status: st });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post('/test', (req, res) => {
  try {
    const seconds = req.body?.seconds != null ? Number(req.body.seconds) : 5;
    if (!Number.isFinite(seconds) || seconds <= 0) return res.status(400).json({ ok: false, error: 'Invalid seconds' });
    const r = bachlauf.testPulse(seconds);
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
