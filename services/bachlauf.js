// services/bachlauf.js
import { setPump } from './gpio.js';
import config from '../config.js';

let running = false;
let since = null;
let autoOffTimer = null;
let autoOffEnd = null; // timestamp in ms when pump will auto-stop
let manualHoldUntil = null; // timestamp ms until which manual requests hold priority (timed)
let manualHold = false; // when true, manual start is indefinite until explicit stop

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

  if (dur != null) {
    // Timed manual start: set auto-off and manualHoldUntil
    const autoOff = dur;
    autoOffEnd = Date.now() + autoOff * 1000;
    manualHold = false;
    manualHoldUntil = autoOffEnd;
    autoOffTimer = setTimeout(() => {
      // when manual timer expires, clear manualHold and stop pump
      manualHoldUntil = null;
      stopPump();
    }, autoOff * 1000);
    return { running, since, autoOffIn: autoOff };
  }

  // Indefinite manual start: run until explicit stop
  autoOffEnd = null;
  manualHoldUntil = null;
  manualHold = true;
  return { running, since, autoOffIn: null, manualHold: true };
}

export function stopPump() {
  clearAutoOff();
  console.log('[bachlauf] stopPump called');
  setPump(false);
  running = false;
  since = null;
  manualHoldUntil = null;
  manualHold = false;
  return { running };
}

// Force the pump ON indefinitely (used by scheduler when Module 2 is active)
export function forceOn() {
  // Do not clear manual auto-off timers when scheduler forces pump on.
  console.log('[bachlauf] forceOn (scheduler)');
  setPump(true);
  running = true;
  if (!since) since = new Date().toISOString();
  return { running, since, autoOffEnd };
}

// Force the pump OFF immediately (used by scheduler when Module 2 becomes inactive)
export function forceOff() {
  // If a manual hold is active (timed) or manualHold (indefinite), ignore scheduler forceOff
  if (manualHold || (manualHoldUntil && Date.now() < manualHoldUntil)) {
    console.log('[bachlauf] forceOff ignored due to manualHold (manual=%s until=%s)', manualHold, manualHoldUntil ? new Date(manualHoldUntil).toISOString() : '-');
    return { running };
  }
  clearAutoOff();
  console.log('[bachlauf] forceOff (scheduler)');
  setPump(false);
  running = false;
  since = null;
  manualHoldUntil = null;
  manualHold = false;
  return { running };
}

export function getStatus() {
  let remaining = null;
  if (autoOffEnd) {
    const ms = autoOffEnd - Date.now();
    remaining = ms > 0 ? Math.ceil(ms / 1000) : 0;
  }
  let manualRemaining = null;
  if (manualHoldUntil) {
    const ms2 = manualHoldUntil - Date.now();
    manualRemaining = ms2 > 0 ? Math.ceil(ms2 / 1000) : 0;
  }
  return { running, since, autoOffRemaining: remaining, manualHoldRemaining: manualRemaining, manualHold };
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
