// routes/calendar.js
import { Router } from 'express';
import { getCalendarEvents, saveCalendarEvents } from '../services/calendar-store.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json(getCalendarEvents());
  } catch (e) {
    res.status(500).json({ error: 'Failed to load calendar events', detail: e?.message || String(e) });
  }
});

router.put('/', (req, res) => {
  try {
    const saved = saveCalendarEvents(Array.isArray(req.body) ? req.body : []);
    res.json({ ok: true, count: saved.length });
  } catch (e) {
    res.status(400).json({ error: 'Failed to save calendar events', detail: e?.message || String(e) });
  }
});

router.post('/save', (req, res) => {
  try {
    const saved = saveCalendarEvents(Array.isArray(req.body) ? req.body : []);
    res.json({ ok: true, count: saved.length });
  } catch (e) {
    res.status(400).json({ error: 'Failed to save calendar events', detail: e?.message || String(e) });
  }
});

export default router;
