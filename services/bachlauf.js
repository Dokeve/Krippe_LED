// services/bachlauf.js (removed implementation)
// This file is a minimal stub to keep API shape for routes and scheduler.
// All functions are no-ops and do not touch hardware.

let running = false;
let since = null;

export function startPump(_durationSec) {
  // Not implemented: keep API contract but do nothing
  running = false;
  since = null;
  return { running, message: 'bachlauf disabled' };
}

export function stopPump() {
  running = false;
  since = null;
  return { running, message: 'bachlauf disabled' };
}

export function forceOn() {
  // scheduler calls this; no-op
  return { running: false, message: 'bachlauf disabled' };
}

export function forceOff() {
  return { running: false, message: 'bachlauf disabled' };
}

export function getStatus() {
  return { running: false, since: null, message: 'bachlauf disabled' };
}

export async function testPulse(_seconds = 5) {
  return { ok: false, error: 'bachlauf disabled' };
}

export default { startPump, stopPump, forceOn, forceOff, getStatus, testPulse };
