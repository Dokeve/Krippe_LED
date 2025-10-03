// services/star-store.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import path from 'node:path';
import { ensureDir, readJson, writeJson } from './file-utils.js';

const DATA_DIR = path.join(process.cwd(), 'data');
ensureDir(DATA_DIR);
const FILE = path.join(DATA_DIR, 'star.json');

function computeFields(cfg) {
  const distanceCm = Number(cfg.distanceCm || 0);
  const startDate = cfg.startDate || null;
  const endDate = cfg.endDate || null;

  const secondsPerDay = (() => {
    const ts = cfg.dailyStart;
    const te = cfg.dailyEnd;
    if (!ts || !te || !/^\d{2}:\d{2}$/.test(ts) || !/^\d{2}:\d{2}$/.test(te)) return 0;
    const [sh, sm] = ts.split(':').map(Number);
    const [eh, em] = te.split(':').map(Number);
    const s = sh * 3600 + sm * 60;
    const e = eh * 3600 + em * 60;
    return e > s ? (e - s) : 0;
  })();

  const days = (() => {
    if (!startDate || !endDate) return 0;
    const a = new Date(`${startDate}T00:00:00`);
    const b = new Date(`${endDate}T00:00:00`);
    const diff = Math.floor((b - a) / 86400000) + 1;
    return Math.max(0, diff);
  })();

  const cmPerDay = days > 0 ? (distanceCm / days) : 0;
  const speedCmPerSec = secondsPerDay > 0 ? (cmPerDay / secondsPerDay) : 0;

  return {
    ...cfg,
    computed: {
      days,
      cmPerDay,
      secondsPerDay,
      speedCmPerSec
    }
  };
}

export async function get() {
  const cfg = readJson(FILE, {
    enabled: false,
    distanceCm: 0,
    startDate: null,
    endDate: null,
    dailyStart: '19:00',
    dailyEnd: '19:30'
  }) || {};
  return computeFields(cfg);
}

export async function set(cfg) {
  const clean = {
    enabled: !!cfg.enabled,
    distanceCm: Number(cfg.distanceCm || 0),
    startDate: cfg.startDate || null,
    endDate: cfg.endDate || null,
    dailyStart: cfg.dailyStart || null,
    dailyEnd: cfg.dailyEnd || null
  };
  writeJson(FILE, clean);
  return computeFields(clean);
}

export default { get, set };
