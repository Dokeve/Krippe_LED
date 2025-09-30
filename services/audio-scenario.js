// services/audio-scenario.js
// Letzte Änderung: 30.08.2025 19.15 Uhr
const path = require('path');
const db = require('./db');
const { getActiveScenarioAt } = require('./scenario-controll');
const config = require('../config');

let player = null;
try {
  // Optional: z.B. play-sound
  player = require('play-sound')({});
} catch {
  console.warn('[SIMULATION] Audio-Player nicht verfügbar – Audio wird simuliert');
}

let bgCurrent = null;
let speechLock = false;

async function tickAudio(secondInCycle) {
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

  // Sprachdateien zeitgesteuert: Wenn Datum innerhalb [from, to] und Modul 2 aktiv → abspielen
  // (Modulsteuerung passiert im Scheduler; hier checken wir periodisch)
  const today = new Date().toISOString().slice(0,10);
  const list = audioCfg.speech || [];
  for (const s of list) {
    if (!s.file) continue;
    if (s.from && today < s.from) continue;
    if (s.to && today > s.to) continue;
    // Vereinfachung: wenn Bedingung zutrifft, anstoßen (mit Lock, damit nicht gespammt)
    if (!speechLock) {
      speechLock = true;
      playSpeech(s.file, audioCfg.volume?.speech ?? 100).finally(()=>{ speechLock=false; });
      break;
    }
  }
}

function fullPath(base, f) {
  if (!f) return null;
  if (path.isAbsolute(f)) return f;
  return path.join(base, f);
}

function playBackground(file, vol=100) {
  const f = fullPath(config.paths.audio.background, file);
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
  player._bg = player.play(f, { afplay: ['-v', vol/100] }, err => {
    if (err) console.error('BG audio error:', err.message);
    bgCurrent = null;
  });
}

function stopBackground() {
  if (player && player._bg && player._bg.kill) {
    try { player._bg.kill(); } catch {}
  } else if (bgCurrent) {
    console.log('[SIMULATION] Hintergrundmusik STOP');
  }
  bgCurrent = null;
}

function playSpeech(file, vol=100) {
  const f = fullPath(config.paths.audio.speech, file);
  if (!f) return Promise.resolve();
  stopBackground(); // ducken
  if (!player) {
    console.log('[SIMULATION] Sprachdatei:', f, 'vol', vol);
    return new Promise(res => setTimeout(res, 2000));
  }
  return new Promise((resolve) => {
    const pr = player.play(f, { afplay: ['-v', vol/100] }, err => {
      if (err) console.error('Speech error:', err.message);
      resolve();
      bgCurrent = null; // erlauben, dass Tick wieder BG startet
    });
    player._speech = pr;
  });
}

module.exports = { tickAudio, stopBackground, playSpeech };
