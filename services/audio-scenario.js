// services/audio-scenario.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import path from 'node:path';
import { createRequire } from 'node:module';
import * as db from './db.js';
import { getActiveScenarioAt } from './scenario-controll.js';
import config from '../config.js';

const require = createRequire(import.meta.url);

let player = null;
try {
  player = require('play-sound')({});
} catch {
  console.warn('[SIMULATION] Audio-Player nicht verfuegbar - Audio wird simuliert');
}

const AUDIO_BACKGROUND_DIR = config.paths?.audio?.background
  ?? config.paths?.audioBgm
  ?? path.join(config.paths?.audioRoot ?? path.resolve('audio'), 'Hintergrundmusik');

const AUDIO_SPEECH_DIR = config.paths?.audio?.speech
  ?? config.paths?.audioSpeech
  ?? path.join(config.paths?.audioRoot ?? path.resolve('audio'), 'Audioprachdateien');

let bgCurrent = null;
let speechLock = false;

export async function tickAudio(secondInCycle) {
  const audioCfg = await db.getAudio();
  const { name } = getActiveScenarioAt(secondInCycle);

  // Hintergrund je Szenario
  const bgMap = audioCfg.background || {}; // { 'Tag': 'Tag.mp3', ... }
  const file = bgMap[name];
  if (file && !speechLock) {
    playBackground(file, audioCfg.volume?.background ?? 100);
  } else if (!file) {
    stopBackground();
  }

  // Sprachdateien zeitgesteuert: Wenn Datum innerhalb [from, to] und Modul 2 aktiv ? abspielen
  const today = new Date().toISOString().slice(0, 10);
  const list = audioCfg.speech || [];
  for (const s of list) {
    if (!s.file) continue;
    if (s.from && today < s.from) continue;
    if (s.to && today > s.to) continue;
    if (!speechLock) {
      speechLock = true;
      playSpeech(s.file, audioCfg.volume?.speech ?? 100).finally(() => { speechLock = false; });
      break;
    }
  }
}

function fullPath(base, f) {
  if (!f) return null;
  if (path.isAbsolute(f)) return f;
  return path.join(base, f);
}

export function playBackground(file, vol = 100) {
  const f = fullPath(AUDIO_BACKGROUND_DIR, file);
  if (!f) return;
  if (!player) {
    if (bgCurrent !== f) {
      console.log('[SIMULATION] Hintergrundmusik:', f, 'vol', vol);
      bgCurrent = f;
    }
    return;
  }
  if (bgCurrent === f) return;
  stopBackground();
  bgCurrent = f;
  player._bg = player.play(f, { afplay: ['-v', vol / 100] }, err => {
    if (err) console.error('BG audio error:', err.message);
    bgCurrent = null;
  });
}

export function stopBackground() {
  if (player && player._bg && player._bg.kill) {
    try { player._bg.kill(); } catch {}
  } else if (bgCurrent) {
    console.log('[SIMULATION] Hintergrundmusik STOP');
  }
  bgCurrent = null;
}

export function playSpeech(file, vol = 100) {
  const f = fullPath(AUDIO_SPEECH_DIR, file);
  if (!f) return Promise.resolve();
  stopBackground(); // ducken
  if (!player) {
    console.log('[SIMULATION] Sprachdatei:', f, 'vol', vol);
    return new Promise(res => setTimeout(res, 2000));
  }
  return new Promise((resolve) => {
    const pr = player.play(f, { afplay: ['-v', vol / 100] }, err => {
      if (err) console.error('Speech error:', err.message);
      resolve();
      bgCurrent = null; // erlauben, dass Tick wieder BG startet
    });
    player._speech = pr;
  });
}

export default { tickAudio, stopBackground, playSpeech };
