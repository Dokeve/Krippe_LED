// services/mode-store.js
// Verwaltet den aktuellen LED-Modus in einer kleinen JSON-Datei.
import path from 'node:path';
import config from '../config.js';
import { ensureDir, readJson, writeJson } from './file-utils.js';

const MODE_FILE = path.join(config.paths.data, 'mode.json');
const DEFAULT_MODE = { mode: 'auto' };

export function getMode() {
  ensureDir(path.dirname(MODE_FILE));
  const data = readJson(MODE_FILE, DEFAULT_MODE);
  return typeof data?.mode === 'string' ? data.mode : 'auto';
}

export function saveMode(mode) {
  const clean = typeof mode === 'string' ? mode.trim() : 'auto';
  ensureDir(path.dirname(MODE_FILE));
  writeJson(MODE_FILE, { mode: clean });
  return clean;
}

export default {
  getMode,
  saveMode
};
