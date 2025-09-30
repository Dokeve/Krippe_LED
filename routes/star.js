// routes/star.js
// Letzte Änderung: 02.09.2025 11:25 Uhr
const express = require('express');
const router = express.Router();
const store = require('../services/star-store');

// Status/Config lesen
router.get('/', async (_req, res) => {
  try {
    const cfg = await store.get();
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Config setzen (berechnet automatisch die Geschwindigkeit)
router.put('/', async (req, res) => {
  try {
    const cfg = await store.set(req.body || {});
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
