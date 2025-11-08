// scripts/test-audio-button-onoff.js
// Simple test utility using `onoff` (sysfs/libgpiod) to watch a button pin.
// Usage examples:
//   BUTTON_PIN=17 PULL=up sudo node scripts/test-audio-button-onoff.js
//   BUTTON_PIN=17 PULL=down node scripts/test-audio-button-onoff.js

import { Gpio } from 'onoff';

const PIN = process.env.BUTTON_PIN ? Number(process.env.BUTTON_PIN) : 5;
const PULL = (process.env.PULL || 'down').toLowerCase();
const activeLow = PULL === 'up'; // if pull-up, button likely active-low

console.log('onoff test - pin=', PIN, 'pull=', PULL, 'activeLow=', activeLow);

let btn;
try {
  btn = new Gpio(PIN, 'in', 'both', { debounceTimeout: 50, activeLow });
} catch (err) {
  console.error('Failed to initialize onoff Gpio:', err?.message || err);
  process.exit(1);
}

// initial read
try {
  const level = btn.readSync();
  console.log('Initial level (readSync)=', level);
} catch (e) {
  console.warn('readSync failed:', e?.message || e);
}

btn.watch((err, value) => {
  if (err) {
    console.error('watch error:', err);
    return;
  }
  console.log(new Date().toISOString(), 'watch value=', value);
});

console.log('Watching for button events. Press Ctrl+C to exit.');

process.on('SIGINT', () => {
  try { btn.unexport(); } catch (e) {}
  process.exit(0);
});
