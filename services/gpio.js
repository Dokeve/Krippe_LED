// services/gpio.js
import { Gpio } from 'onoff';
import config from '../config.js';

let pump = null;
let audioButton = null;

export async function initGpio() {
  try {
    const pumpPin = Number(config.gpio?.pump ?? 19);
    const btnPin = Number(config.gpio?.audioButton ?? 4);

    pump = new Gpio(pumpPin, 'out');
    audioButton = new Gpio(btnPin, 'in', 'rising', { debounceTimeout: 50 });

    console.log(`[GPIO] pump@${pumpPin} (out), audioButton@${btnPin} (in,rising)`);
  } catch (error) {
    console.warn('[GPIO] Initialisierung übersprungen:', error?.message || error);
  }
}

export function setPump(on) {
  try {
    if (pump) pump.writeSync(on ? 1 : 0);
  } catch (error) {
    console.warn('[GPIO] setPump Fehler:', error?.message || error);
  }
}

export function onAudioButton(cb) {
  if (!audioButton || typeof cb !== 'function') return;
  audioButton.watch((_err, value) => {
    if (value === 1) cb();
  });
}
