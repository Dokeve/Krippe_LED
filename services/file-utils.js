// services/file-utils.js
// Letzte Änderung: 30.08.2025 19.15 Uhr
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath, fallback = null) {
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

function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('[file-utils] writeJson error:', e);
    return false;
  }
}

function listFilesSafe(dir, exts = []) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    return list
      .filter(d => d.isFile())
      .map(d => d.name)
      .filter(n => exts.length ? exts.some(ext => n.toLowerCase().endsWith(ext)) : true)
      .sort();
  } catch (e) {
    console.warn('[file-utils] listFilesSafe failed:', e.message);
    return [];
  }
}

module.exports = { ensureDir, readJson, writeJson, listFilesSafe };
