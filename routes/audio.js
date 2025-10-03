// routes/audio.js
import { Router } from 'express';

const router = Router();

// TODO: Replace placeholder logic with real DB-backed audio service
router.get('/', (_req, res) => {
  res.status(501).json({ error: 'Audio API not implemented yet', todo: ['Load audio config from DB', 'Return speech/background lists'] });
});

router.put('/', (_req, res) => {
  res.status(501).json({ error: 'Audio API not implemented yet', todo: ['Validate payload', 'Persist audio config', 'Trigger scheduler/audio reload'] });
});

export default router;
