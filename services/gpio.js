// services/gpio.js
import { Gpio } from 'pigpio';
import config from '../config.js';

let pump = null;
let audioButton = null;
let audioButtonHandler = null;

export async function initGpio() {
  try {
    const pumpPin = Number(config.gpio?.pump ?? 19);
    const btnPin = Number(config.gpio?.audioButton ?? 17);
    // Polarity: if activeHigh === false, the relay is active LOW (0 turns it on)
    const activeHigh = config.gpio?.activeHigh !== false;

    pump = new Gpio(pumpPin, { mode: Gpio.OUTPUT });
    // ensure pump is in OFF state at init according to polarity
    pump.digitalWrite(activeHigh ? 0 : 1);

    audioButton = new Gpio(btnPin, {
      mode: Gpio.INPUT,
      pullUpDown: Gpio.PUD_DOWN,
      alert: true
    });
    audioButton.glitchFilter(50000);
    audioButton.enableAlert();
    audioButton.on('alert', (level) => {
      if (level === 1 && typeof audioButtonHandler === 'function') {
        audioButtonHandler();
      }
    });

    console.log(`[GPIO] pump@${pumpPin} (out, activeHigh=${activeHigh}), audioButton@${btnPin} (in,alert) using pigpio`);
  } catch (error) {
    console.warn('[GPIO] Initialisierung übersprungen:', error?.message || error);
  }
}

export function setPump(on) {
  try {
    if (pump) {
      const activeHigh = config.gpio?.activeHigh !== false;
      const value = on ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
      pump.digitalWrite(value);
      try { console.log(`[GPIO] setPump -> pin write value=${value} (on=${on}, activeHigh=${activeHigh})`); } catch {}
    }
  } catch (error) {
    console.warn('[GPIO] setPump Fehler:', error?.message || error);
  }
}

export function onAudioButton(cb) {
  audioButtonHandler = typeof cb === 'function' ? cb : null;
}
