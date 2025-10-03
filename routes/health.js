// routes/health.js
import { Router } from 'express';
import fs from 'node:fs';
import config from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    env: config.env,
    time: new Date().toISOString(),
    db: { mode: config.useFileDb ? 'file' : 'mariadb' },
    audio: {
      dir: config.paths.audioRoot,
      exists: fs.existsSync(config.paths.audioRoot ?? '')
    },
    led: config.led
  });
});

export default router;
