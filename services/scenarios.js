import * as LED from './ws2812.js';
import * as GPIO from './gpio.js';
import { Log } from './log.js';

export async function applyModule(mod) {
  if (mod === 1) {
    LED.setAll('#ffd48a');
    GPIO.flowOn();
    Log.info('Szenario: Modul 1 aktiv');
  } else if (mod === 2) {
    LED.setAll('#334466');
    GPIO.flowOff();
    Log.info('Szenario: Modul 2 aktiv');
  } else {
    throw new Error('Unbekanntes Modul: ' + mod);
  }
}
