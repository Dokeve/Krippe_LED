import { Router } from 'express';
import bachlauf from '../services/bachlauf.js';

const router = Router();

// GET /api/bachlauf/status
router.get('/status', (_req, res) => {
  try {
    res.json(bachlauf.getStatus());
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /api/bachlauf/manual  { action: 'on'|'off'|'clear' }
router.post('/manual', (req, res) => {
  const action = String((req.body && req.body.action) || '').toLowerCase();
  if (!['on', 'off', 'clear'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'invalid action' });
  }
  try {
    const status = bachlauf.setManual(action);
    res.json(status);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
