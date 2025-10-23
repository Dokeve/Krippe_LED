// services/gpio.js
import { Gpio } from 'pigpio';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { spawnSync } from 'child_process';

let pump = null;
let audioButton = null;
let audioButtonHandler = null;
// gewünschter Pumpenzustand, wird gesetzt auch wenn pigpio noch nicht initialisiert ist
let desiredPumpState = false;

export async function initGpio() {
  const pumpPin = Number(config.gpio?.pump ?? 19);
  const btnPin = Number(config.gpio?.audioButton ?? 17);
  const activeHigh = config.gpio?.activeHigh !== false;

  const MAX_ATTEMPTS = Number(process.env.GPIO_INIT_RETRIES ?? 5);
  const RETRY_DELAY_MS = Number(process.env.GPIO_INIT_RETRY_DELAY_MS ?? 500);

  // Before trying to initialize pigpio, wait for pigpiod to create its socket/pid
  const SOCKET_PATH = process.env.PIGPIO_SOCKET_PATH || '/var/run/pigpio.sock';
  const PID_PATH = process.env.PIGPIO_PID_PATH || '/var/run/pigpio.pid';
  const SOCKET_WAIT_ATTEMPTS = Number(process.env.PIGPIO_SOCKET_WAIT_ATTEMPTS ?? 10);
  const SOCKET_WAIT_DELAY_MS = Number(process.env.PIGPIO_SOCKET_WAIT_DELAY_MS ?? 200);

  let socketOk = false;
  for (let i = 0; i < SOCKET_WAIT_ATTEMPTS; i++) {
    try {
      if (fs.existsSync(SOCKET_PATH) || fs.existsSync(PID_PATH)) {
        socketOk = true;
        break;
      }
    } catch (e) {
      // ignore
    }
    // wait
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, SOCKET_WAIT_DELAY_MS));
  }
  if (!socketOk) {
    console.warn(`[GPIO] pigpiod socket/pid not found at ${SOCKET_PATH} or ${PID_PATH} after ${SOCKET_WAIT_ATTEMPTS} attempts`);
    // continue — the retry loop below will still attempt to init and will log errors
  }

  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      pump = new Gpio(pumpPin, { mode: Gpio.OUTPUT });
      // apply desired pump state at init according to polarity
      const initValue = desiredPumpState ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
      pump.digitalWrite(initValue);

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
      return;
    } catch (error) {
      const msg = error?.message || String(error);
      // If this was the last attempt, log a warning and give up
      if (attempt >= MAX_ATTEMPTS) {
        console.warn('[GPIO] Initialisierung übersprungen:', msg);
        return;
      }
      // Otherwise wait a bit and retry
      console.warn(`[GPIO] gpioInitialise fehlgeschlagen (attempt ${attempt}/${MAX_ATTEMPTS}): ${msg} — retrying in ${RETRY_DELAY_MS}ms`);
      // sleep
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    }
  }
}

export function setPump(on) {
  try {
    // Merke den gewünschten Zustand auch wenn pump noch null ist
    desiredPumpState = !!on;
    if (pump) {
      const activeHigh = config.gpio?.activeHigh !== false;
      const value = on ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
      pump.digitalWrite(value);
      try { console.log(`[GPIO] setPump -> pin write value=${value} (on=${on}, activeHigh=${activeHigh})`); } catch {}
    } else {
      // Fallback: if pigpio isn't available, try using the pigs CLI which talks to pigpiod
      try {
        const activeHigh = config.gpio?.activeHigh !== false;
        const pin = Number(config.gpio?.pump ?? 19);
        const value = on ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
        // spawnSync to perform the write synchronously
        const res = spawnSync('pigs', ['w', String(pin), String(value)], { encoding: 'utf8' });
        if (res.error) {
          console.warn('[GPIO] pigs CLI fallback failed:', res.error.message || res.error);
        } else if (res.status !== 0) {
          console.warn('[GPIO] pigs CLI fallback exited with status', res.status, res.stdout || res.stderr);
        } else {
          console.log(`[GPIO] pigs fallback -> pin write value=${value} (on=${on}, activeHigh=${activeHigh})`);
        }
      } catch (err) {
        console.warn('[GPIO] pigs fallback thrown error:', err?.message || err);
      }
    }
  } catch (error) {
    console.warn('[GPIO] setPump Fehler:', error?.message || error);
  }
}

export function onAudioButton(cb) {
  audioButtonHandler = typeof cb === 'function' ? cb : null;
}
