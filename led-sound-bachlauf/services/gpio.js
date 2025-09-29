// services/gpio.js
import { Gpio } from 'onoff';
import { getSetting } from './db.js';

let pump = null;
let audioButton = null;

export async function initGpio() {
  const pumpPin = parseInt(await getSetting('gpio.pump', '19'), 10);
  const btnPin  = parseInt(await getSetting('gpio.audio.button', '13'), 10);

  pump = new Gpio(pumpPin, 'out');
  audioButton = new Gpio(btnPin, 'in', 'rising', { debounceTimeout: 50 });

  console.log(`[GPIO] pump@${pumpPin} (out), audioButton@${btnPin} (in,rising)`);
}

export function setPump(on) { if (pump) pump.writeSync(on ? 1 : 0); }

export function onAudioButton(cb) {
  if (!audioButton) return;
  audioButton.watch((_err, value) => { if (value === 1) cb(); });
}
