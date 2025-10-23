// services/audio-store.js
import path from 'node:path';
import fs from 'node:fs';
import config from '../config.js';
import { ensureDir, readJson, writeJson } from './file-utils.js';

const AUDIO_FILE = path.join(config.paths.data, 'audio.json');

const DEFAULT_AUDIO = {
  volume: { speech: 100, background: 100 },
  speech: [],
  background: {
    'Tag': '',
    'Tag-Nacht': '',
    'Nacht': '',
    'Nacht-Tag': ''
  }
};

function sanitizeSpeechEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = String(entry.label || '').trim();
  const file = String(entry.file || '').trim();
  const from = typeof entry.from === 'string' ? entry.from : '';
  const to = typeof entry.to === 'string' ? entry.to : '';
  if (!file) return null;
  return { label, file, from, to };
}

function sanitizeAudioConfig(input = {}) {
  const volume = {
    speech: clamp(Number(input?.volume?.speech ?? 100), 0, 100),
    background: clamp(Number(input?.volume?.background ?? 100), 0, 100)
  };

  const speech = Array.isArray(input?.speech)
    ? input.speech.map(sanitizeSpeechEntry).filter(Boolean)
    : [];

  const background = { ...DEFAULT_AUDIO.background };
  for (const key of Object.keys(background)) {
    const val = input?.background?.[key];
    background[key] = typeof val === 'string' ? val.trim() : '';
  }

  return { volume, speech, background };
}

function clamp(num, min, max) {
  if (Number.isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function getAudioConfig() {
  try {
    ensureDir(path.dirname(AUDIO_FILE));
    const data = readJson(AUDIO_FILE, DEFAULT_AUDIO);
    return sanitizeAudioConfig(data);
  } catch (e) {
    console.warn('[audio-store] getAudioConfig fallback auf Default:', e?.message || e);
    return { ...DEFAULT_AUDIO };
  }
}

export function saveAudioConfig(cfg) {
  const sanitized = sanitizeAudioConfig(cfg);
  ensureDir(path.dirname(AUDIO_FILE));
  writeJson(AUDIO_FILE, sanitized);
  return sanitized;
}

export default {
  getAudioConfig,
  saveAudioConfig
};
