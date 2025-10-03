// routes/files.js
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config.js';

const router = Router();
const ALLOWED_DIRS = [
  config.paths?.audioRoot,
  config.paths?.audioSpeech,
  config.paths?.audioBgm
].filter(Boolean).map((p) => path.resolve(p));

router.get('/', async (req, res) => {
  try {
    const requested = req.query.path;
    if (typeof requested !== 'string' || !requested.trim()) {
      return res.status(400).json({ error: 'Parameter "path" erforderlich' });
    }
    const target = path.resolve(requested);
    if (!ALLOWED_DIRS.some((base) => target.startsWith(base))) {
      return res.status(403).json({ error: 'Pfad nicht erlaubt' });
    }

    const dirents = await fs.readdir(target, { withFileTypes: true });
    const files = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => /\.(mp3|wav)$/i.test(name));

    res.json(files.sort());
  } catch (e) {
    res.status(500).json({ error: 'Dateiliste konnte nicht gelesen werden', detail: e?.message || String(e) });
  }
});

export default router;
