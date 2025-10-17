// services/bachlauf.js
import { setPump } from './gpio.js';
import config from '../config.js';

let running = false;
let since = null;
let autoOffTimer = null;
let autoOffEnd = null; // timestamp in ms when pump will auto-stop

const DEFAULT_AUTO_OFF = Number(config.bachlauf?.defaultAutoOff ?? 15 * 60); // seconds
const MAX_DURATION = Number(config.bachlauf?.maxDuration ?? 3600); // seconds

function clearAutoOff() {
  if (autoOffTimer) {
    clearTimeout(autoOffTimer);
    autoOffTimer = null;
    autoOffEnd = null;
  }
}

export function startPump(durationSec) {
  clearAutoOff();
  const dur = typeof durationSec === 'number' && isFinite(durationSec) ? Math.min(durationSec, MAX_DURATION) : null;

  console.log('[bachlauf] startPump durationSec=', dur);
  setPump(true);
  running = true;
  since = new Date().toISOString();

  const autoOff = dur != null ? dur : DEFAULT_AUTO_OFF;
  autoOffEnd = Date.now() + autoOff * 1000;
  autoOffTimer = setTimeout(() => {
    stopPump();
  }, autoOff * 1000);

  return { running, since, autoOffIn: autoOff };
}

export function stopPump() {
  clearAutoOff();
  console.log('[bachlauf] stopPump called');
  setPump(false);
  running = false;
  since = null;
  return { running };
}

// Force the pump ON indefinitely (used by scheduler when Module 2 is active)
export function forceOn() {
  clearAutoOff();
  console.log('[bachlauf] forceOn (scheduler)');
  setPump(true);
  running = true;
  since = new Date().toISOString();
  autoOffEnd = null;
  return { running, since };
}

// Force the pump OFF immediately (used by scheduler when Module 2 becomes inactive)
export function forceOff() {
  clearAutoOff();
  console.log('[bachlauf] forceOff (scheduler)');
  setPump(false);
  running = false;
  since = null;
  return { running };
}

export function getStatus() {
  let remaining = null;
  if (autoOffEnd) {
    const ms = autoOffEnd - Date.now();
    remaining = ms > 0 ? Math.ceil(ms / 1000) : 0;
  }
  return { running, since, autoOffRemaining: remaining };
}

export async function testPulse(seconds = 5) {
  // Short test: run pump for `seconds`, but never exceed MAX_DURATION
  const s = Math.max(1, Math.min(seconds, 30));
  // Start pump for s seconds and return immediately; record end time
  startPump(s);
  return { ok: true, testDuration: s };
}

export default {
  startPump,
  stopPump,
  getStatus,
  testPulse,
  forceOn,
  forceOff
};
