// services/audio-scenario.js
// Audio-Steuerung (Ducking, Sprachclips) - nutzt audio-store statt DB
import path from 'node:path';
import { createRequire } from 'node:module';
import { getAudioConfig } from './audio-store.js';
import { getActiveScenarioAt } from './scenario-controll.js';
import config from '../config.js';

const require = createRequire(import.meta.url);

let player = null;
try {
  player = require('play-sound')({ player: 'mpg123' });
} catch (error) {
  console.warn('[Audio] play-sound/mpg123 nicht verfuegbar - Audio wird simuliert:', error?.message || error);
}

const AUDIO_ROOT = config.paths?.audioRoot ?? path.join(process.cwd(), 'audio');
const AUDIO_BACKGROUND_DIR = config.paths?.audioBgm ?? path.join(AUDIO_ROOT, 'Hintergrundmusik');
const AUDIO_SPEECH_DIR = config.paths?.audioSpeech ?? path.join(AUDIO_ROOT, 'Audiosprachdateien');

let bgCurrent = null;
let bgProcess = null;
let speechProcess = null;
let speechLock = false;

const clampVolume = (value) => Math.max(0, Math.min(100, Math.round(value)));
const mpgArgs = (volume) => ['--scale', String(clampVolume(volume)), '-q'];

const playFile = (filePath, volume, tag) => {
  if (!player) {
    console.log('[SIMULATION]', tag, filePath, 'vol', volume);
    return null;
  }
  try {
    return player.play(filePath, { mpg123: mpgArgs(volume) }, (error) => {
      if (error) {
        console.error(`[Audio] ${tag} Fehler:`, error.message || error);
      }
    });
  } catch (error) {
    console.error(`[Audio] ${tag} Start fehlgeschlagen:`, error.message || error);
    return null;
  }
};

function fullPath(base, relative) {
  if (!relative) return null;
  if (path.isAbsolute(relative)) return relative;
  return path.join(base, relative);
}

export function playBackground(file, volume = 100) {
  const resolved = fullPath(AUDIO_BACKGROUND_DIR, file);
  if (!resolved) return;
  if (bgCurrent === resolved && bgProcess) return;

  stopBackground();
  const child = playFile(resolved, volume, 'Hintergrundmusik');
  if (child) {
    bgCurrent = resolved;
    bgProcess = child;
    child.on('close', () => {
      if (bgProcess === child) bgProcess = null;
      if (bgCurrent === resolved) bgCurrent = null;
    });
  } else if (!player) {
    bgCurrent = resolved;
  }
}

export function stopBackground() {
  if (bgProcess && typeof bgProcess.kill === 'function') {
    try {
      bgProcess.kill();
    } catch (error) {
      console.error('[Audio] stopBackground kill:', error?.message || error);
    }
  } else if (bgCurrent && !player) {
    console.log('[SIMULATION] Hintergrundmusik STOP');
  }
  bgProcess = null;
  bgCurrent = null;
}

export function playSpeech(file, volume = 100) {
  const resolved = fullPath(AUDIO_SPEECH_DIR, file);
  if (!resolved) return Promise.resolve();

  stopBackground();

  if (!player) {
    console.log('[SIMULATION] Sprachdatei:', resolved, 'vol', volume);
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (speechProcess && typeof speechProcess.kill === 'function') {
    try {
      speechProcess.kill();
    } catch (error) {
      console.error('[Audio] playSpeech kill:', error?.message || error);
    }
  }
  speechProcess = null;

  return new Promise((resolve) => {
    const child = playFile(resolved, volume, 'Sprachdatei');
    if (!child) {
      resolve();
      return;
    }
    speechProcess = child;
    child.on('close', () => {
      if (speechProcess === child) speechProcess = null;
      resolve();
    });
  });
}

export async function tickAudio(secondInCycle) {
  const audioCfg = getAudioConfig();
  const { name } = getActiveScenarioAt(secondInCycle);

  const backgroundMap = audioCfg.background || {};
  const background = backgroundMap[name];
  if (background && !speechLock) {
    playBackground(background, audioCfg.volume?.background ?? 100);
  } else if (!background) {
    stopBackground();
  }

  const today = new Date().toISOString().slice(0, 10);
  const speechEntries = audioCfg.speech || [];
  for (const entry of speechEntries) {
    if (!entry?.file) continue;
    if (entry.from && today < entry.from) continue;
    if (entry.to && today > entry.to) continue;

    if (!speechLock) {
      speechLock = true;
      playSpeech(entry.file, audioCfg.volume?.speech ?? 100)
        .catch((error) => console.error('[Audio] Sprachdatei Fehler:', error?.message || error))
        .finally(() => { speechLock = false; });
    }
    break;
  }
}

export default { tickAudio, stopBackground, playSpeech };