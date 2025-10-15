// services/audio-scenario.js
// Audio-Steuerung (Ducking, Sprachclips) - nutzt audio-store statt DB
import path from 'node:path';
import { createRequire } from 'node:module';
import { getAudioConfig } from './audio-store.js';
import { getActiveScenarioAt } from './scenario-controll.js';
import config from '../config.js';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

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
let bgLastStart = 0;
let bgLastStop = 0;
let bgRestartAttempts = 0;
let bgDisabledUntil = 0; // timestamp while we suppress automatic restarts

const MPG123_SCALE_MAX = 32768;
const VOLUME_MAX_PERCENT = 100;
const DUCK_PERCENT = Number.isFinite(Number(config.audio?.duckPercent)) ? Number(config.audio.duckPercent) : 30;
const DEBUG_LOG = config.audio?.debugLogPath;

function appendDebugLog(line) {
  if (!DEBUG_LOG) return;
  try {
    // ensure directory exists
    try {
      const dir = require('node:path').dirname(DEBUG_LOG);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore
    }
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch (e) {
    // ignore write errors
  }
}

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
    appendDebugLog(`${tag} START ${filePath} device=${AUDIO_DEVICE} args=${args.join(' ')} vol=${percent}%`);

    // prefer to spawn mpg123 directly to capture stdout/stderr reliably
    const spawnArgs = [];
    if (AUDIO_DEVICE) {
      spawnArgs.push('-a', AUDIO_DEVICE);
    }
    // force ALSA output module to avoid JACK auto-selection
    spawnArgs.push('-o', 'alsa');
    if (options.loop) {
      spawnArgs.push('--loop', '-1');
    }
    if (clampScale(percentToScale(percent)) !== MPG123_SCALE_MAX) {
      spawnArgs.push('--scale', String(clampScale(percentToScale(percent))));
    }
    spawnArgs.push('-q');
    spawnArgs.push(filePath);

    // avoid rapid respawn storms: if we started a bg process very recently, skip
    try {
      const now = Date.now();
      if (tag === 'Hintergrundmusik' && bgLastStart && now - bgLastStart < 500) {
        appendDebugLog(`${tag} SKIP spawn due to recent start (delta=${now - bgLastStart}ms)`);
        return null;
      }
    } catch (e) {}

    const child = spawn('mpg123', spawnArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    if (child.stdout) {
      child.stdout.on('data', (d) => appendDebugLog(`MPG123 STDOUT: ${String(d).trim()}`));
    }
    if (child.stderr) {
      child.stderr.on('data', (d) => appendDebugLog(`MPG123 STDERR: ${String(d).trim()}`));
    }
    child.on('error', (err) => appendDebugLog(`MPG123 ERROR: ${err?.message || err}`));
    // attach error handler where possible
    try {
      if (child && typeof child.on === 'function') {
        child.on('error', (err) => {
          console.error(`[Audio] ${tag} child error:`, err?.message || err);
          appendDebugLog(`${tag} CHILD ERROR: ${err?.message || err}`);
        });
      }
    } catch (e) {
      // ignore
    }
    appendDebugLog(`${tag} SPAWNED pid=${child.pid || '(no pid)'}`);
    return child;
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

  // suppress automatic restarts while disabled
  const now = Date.now();
  if (bgDisabledUntil && now < bgDisabledUntil) {
    console.warn('[Audio] Hintergrundmusik restart unterdrückt bis', new Date(bgDisabledUntil).toISOString());
    return;
  }

  if (!forceRestart && sameFile && sameVolume && bgProcess) {
    return;
  }

  // If changing file or volume we need to restart. But avoid rapid flip/flap: if last stop was very recent,
  // allow a short cooldown but still perform ducking requests immediately.
  const timeSinceStop = now - bgLastStop;
  if (timeSinceStop < 150 && !forceRestart) {
    // schedule a restart shortly to coalesce rapid changes
    setTimeout(() => playBackground(file, volumePercent, { forceRestart }), 200);
    return;
  }

  // Stop existing process if needed
  if (!forceRestart || !sameFile) {
    stopBackground();
  } else if (bgProcess) {
    try {
      bgProcess.kill();
    } catch (e) {
      console.warn('[Audio] Fehler beim killen des bgProcess:', e?.message || e);
    }
    bgProcess = null;
  }

  const child = playFile(resolved, percent, 'Hintergrundmusik', { loop: true });
  if (child) {
    bgCurrentFile = resolved;
    bgVolumePercent = percent;
    bgProcess = child;
    bgLastStart = Date.now();
    bgRestartAttempts = 0; // reset attempts after successful start
    try {
      console.log('[Audio] Hintergrundmusik child PID', child.pid || '(no pid)');
    } catch (e) {}

    child.on('close', (code, signal) => {
      console.warn('[Audio] Hintergrundmusik Prozess closed', { file: resolved, code, signal });
      if (bgProcess === child) bgProcess = null;
      if (bgCurrentFile === resolved) bgCurrentFile = null;
      bgLastStop = Date.now();
      // increment restart attempts and possibly disable automatic restarts
      bgRestartAttempts += 1;
      if (bgRestartAttempts >= 3) {
        bgDisabledUntil = Date.now() + 10000; // suppress restarts for 10s
        console.error('[Audio] Hintergrundmusik mehrfach abgestürzt — automatische Neustarts für 10s deaktiviert');
      }
    });
    child.on('error', (err) => {
      console.error('[Audio] Hintergrundmusik child error:', err?.message || err);
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
  console.log('[Audio] triggerSpeech aufgerufen, player?', !!player, 'speech entries', (audioCfg.speech || []).length);
  const entry = findActiveSpeechEntry(audioCfg.speech, new Date());
  if (!entry) {
    console.log('[Audio] Keine Sprachdatei aktiv (Zeitraum außerhalb)');
    return false;
  }

  speechLock = true;
  try {
    console.log('[Audio] Sprachdatei starten:', entry.file, 'vol', audioCfg.volume?.speech ?? 100);
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
