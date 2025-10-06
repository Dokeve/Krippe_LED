// services/file-utils.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) {
      if (fallback !== null) {
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
        return fallback;
      }
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('[file-utils] readJson error:', e);
    return fallback;
  }
}

export function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('[file-utils] writeJson error:', e);
    return false;
  }
}

export function listFilesSafe(dir, exts = []) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    return list
      .filter(d => d.isFile())
      .map(d => d.name)
      .filter(n => (exts.length ? exts.some(ext => n.toLowerCase().endsWith(ext)) : true))
      .sort();
  } catch (e) {
    console.warn('[file-utils] listFilesSafe failed:', e.message);
    return [];
  }
}

export default { ensureDir, readJson, writeJson, listFilesSafe };
