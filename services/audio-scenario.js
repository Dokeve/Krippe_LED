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
const AUDIO_DEVICE = (config.audio?.outputDevice || 'hw:1,0').trim();

let bgCurrentFile = null;
let bgProcess = null;
let bgVolumePercent = 100;
let speechProcess = null;
let speechLock = false;

const MPG123_SCALE_MAX = 32768;
const VOLUME_MAX_PERCENT = 100;
const DUCK_PERCENT = 30;

const clampScale = (value) => Math.max(0, Math.min(MPG123_SCALE_MAX, Math.round(value)));
const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(VOLUME_MAX_PERCENT, Math.round(num)));
};
const percentToScale = (percent) => clampScale((clampPercent(percent) / 100) * MPG123_SCALE_MAX);

const buildMpgArgs = (scale, { loop = false } = {}) => {
  const args = [];
  if (loop) args.push('--loop', '-1');
  const clampedScale = clampScale(scale);
  if (clampedScale !== MPG123_SCALE_MAX) {
    args.push('--scale', String(clampedScale));
  }
  args.push('-q');
  if (AUDIO_DEVICE) {
    args.unshift(AUDIO_DEVICE);
    args.unshift('-a');
  }
  return args;
};

const playFile = (filePath, volumePercent, tag, options = {}) => {
  const percent = clampPercent(volumePercent);
  if (!player) {
    console.log('[SIMULATION]', tag, filePath, 'vol', `${percent}%`);
    return null;
  }
  try {
    const scale = percentToScale(percent);
    const args = buildMpgArgs(scale, options);
    console.log(
      `[Audio] ${tag} starte Wiedergabe`,
      filePath,
      AUDIO_DEVICE ? `(device ${AUDIO_DEVICE})` : '(default device)',
      'args',
      args.join(' '),
      'vol',
      `${percent}%`
    );
    return player.play(filePath, { mpg123: args }, (error) => {
      if (error) {
        console.error(`[Audio] ${tag} Fehler:`, error.message || error);
      } else {
        console.log(`[Audio] ${tag} Ende`, filePath);
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

export function playBackground(file, volumePercent = 100, { forceRestart = false } = {}) {
  const resolved = fullPath(AUDIO_BACKGROUND_DIR, file);
  if (!resolved) return;
  const percent = clampPercent(volumePercent);
  const sameFile = bgCurrentFile === resolved;
  const sameVolume = bgVolumePercent === percent;

  if (!forceRestart && sameFile && sameVolume && bgProcess) {
    return;
  }

  if (!forceRestart || !sameFile) {
    stopBackground();
  } else if (bgProcess) {
    bgProcess.kill();
    bgProcess = null;
  }

  const child = playFile(resolved, percent, 'Hintergrundmusik', { loop: true });
  if (child) {
    bgCurrentFile = resolved;
    bgVolumePercent = percent;
    bgProcess = child;
    child.on('close', () => {
      if (bgProcess === child) bgProcess = null;
      if (bgCurrentFile === resolved) bgCurrentFile = null;
    });
  } else if (!player) {
    bgCurrentFile = resolved;
    bgVolumePercent = percent;
  }
}

export function stopBackground() {
  if (bgProcess && typeof bgProcess.kill === 'function') {
    try {
      console.log('[Audio] Hintergrundmusik stop', bgCurrentFile);
      bgProcess.kill();
    } catch (error) {
      console.error('[Audio] stopBackground kill:', error?.message || error);
    }
  } else if (bgCurrentFile && !player) {
    console.log('[SIMULATION] Hintergrundmusik STOP');
  }
  bgProcess = null;
  bgCurrentFile = null;
}

export function playSpeech(file, volumePercent = 100) {
  const resolved = fullPath(AUDIO_SPEECH_DIR, file);
  if (!resolved) return Promise.resolve();

  if (!player) {
    console.log('[SIMULATION] Sprachdatei:', resolved, 'vol', `${clampPercent(volumePercent)}%`);
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
    const child = playFile(resolved, volumePercent, 'Sprachdatei', { loop: false });
    if (!child) {
      if (bgCurrentFile) {
        playBackground(bgCurrentFile, bgVolumePercent, { forceRestart: false });
      }
      resolve();
      return;
    }

    const originalBgFile = bgCurrentFile;
    const originalBgVolume = bgVolumePercent;
    const duckTarget = Math.max(0, Math.min(originalBgVolume, DUCK_PERCENT));
    if (originalBgFile && bgProcess) {
      playBackground(originalBgFile, duckTarget, { forceRestart: false });
    }

    speechProcess = child;
    child.on('close', () => {
      console.log('[Audio] Sprachdatei Ende', resolved);
      if (speechProcess === child) speechProcess = null;
      if (originalBgFile) {
        playBackground(originalBgFile, originalBgVolume, { forceRestart: false });
      }
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
    playBackground(background, audioCfg.volume?.background ?? 100, { forceRestart: false });
  } else if (!background && bgProcess) {
    stopBackground();
  }
}

function parseIsoDate(input) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findActiveSpeechEntry(speechList, referenceDate = new Date()) {
  if (!Array.isArray(speechList)) return null;
  for (const entry of speechList) {
    if (!entry?.file) continue;
    const from = parseIsoDate(entry.from);
    const to = parseIsoDate(entry.to);
    if (from && referenceDate < from) continue;
    if (to && referenceDate > to) continue;
    return entry;
  }
  return null;
}

export function isSpeechActive() {
  return speechLock;
}

export async function triggerSpeech(secondInCycle = 0) {
  if (speechLock) {
    console.log('[Audio] Sprachdatei übersprungen – bereits in Wiedergabe');
    return false;
  }

  const audioCfg = getAudioConfig();
  const entry = findActiveSpeechEntry(audioCfg.speech, new Date());
  if (!entry) {
    console.log('[Audio] Keine Sprachdatei aktiv (Zeitraum außerhalb)');
    return false;
  }

  speechLock = true;
  try {
    await playSpeech(entry.file, audioCfg.volume?.speech ?? 100);
    return true;
  } catch (error) {
    console.error('[Audio] Sprachdatei Fehler:', error?.message || error);
    return false;
  } finally {
    speechLock = false;
  }
}

export default { tickAudio, stopBackground, playSpeech, triggerSpeech, isSpeechActive };
