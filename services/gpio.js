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

    pump = new Gpio(pumpPin, { mode: Gpio.OUTPUT });
    pump.digitalWrite(0);

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

    console.log(`[GPIO] pump@${pumpPin} (out), audioButton@${btnPin} (in,alert) using pigpio`);
  } catch (error) {
    console.warn('[GPIO] Initialisierung übersprungen:', error?.message || error);
  }
}

export function setPump(on) {
  try {
    if (pump) pump.digitalWrite(on ? 1 : 0);
  } catch (error) {
    console.warn('[GPIO] setPump Fehler:', error?.message || error);
  }
}

export function onAudioButton(cb) {
  audioButtonHandler = typeof cb === 'function' ? cb : null;
}
