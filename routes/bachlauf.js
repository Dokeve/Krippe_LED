// routes/bachlauf.js - stubbed out to disable Bachlauf API
import { Router } from 'express';

const router = Router();

// All endpoints intentionally disabled. Return 410 Gone for visibility.
router.use((req, res) => {
  res.status(410).json({ ok: false, error: 'bachlauf disabled' });
});

export default router;
