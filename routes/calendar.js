// routes/calendar.js
import { Router } from 'express';

const router = Router();

// TODO: Implement real calendar CRUD (MariaDB) and validation
router.get('/', (_req, res) => {
  res.status(501).json({ error: 'Calendar API not implemented yet', todo: ['Query calendar events', 'Apply module color metadata', 'Handle pagination/filters'] });
});

router.put('/', (_req, res) => {
  res.status(501).json({ error: 'Calendar API not implemented yet', todo: ['Validate events payload', 'Upsert events (and series)', 'Return updated dataset'] });
});

router.post('/save', (_req, res) => {
  res.status(501).json({ error: 'Calendar save fallback not implemented yet', todo: ['Persist single event', 'Return confirmation'] });
});

export default router;
