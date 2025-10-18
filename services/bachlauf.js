// services/bachlauf.js - disabled implementation
// Exports no-op functions so code that imports the service doesn't fail.

export function startPump() { return { ok: false, error: 'bachlauf disabled' }; }
export function stopPump() { return { ok: false, error: 'bachlauf disabled' }; }
export function forceOn() { return { ok: false, error: 'bachlauf disabled' }; }
export function forceOff() { return { ok: false, error: 'bachlauf disabled' }; }
export function getStatus() { return { ok: false, error: 'bachlauf disabled' }; }
export async function testPulse() { return { ok: false, error: 'bachlauf disabled' }; }

export default { startPump, stopPump, forceOn, forceOff, getStatus, testPulse };
