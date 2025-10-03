// routes/led-groups.js
import { Router } from 'express';

const router = Router();

// TODO: Wire up LED group CRUD with DB/service layer
router.get('/', (_req, res) => {
  res.status(501).json({ error: 'LED groups API not implemented yet', todo: ['Load LED groups/subgroups', 'Include scenarios & colors', 'Return structured response'] });
});

router.put('/', (_req, res) => {
  res.status(501).json({ error: 'LED groups API not implemented yet', todo: ['Validate LED group payload', 'Persist changes', 'Trigger scheduler/LED refresh'] });
});

export default router;
