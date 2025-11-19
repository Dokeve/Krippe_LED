// services/gpio.js
// Lazy-import pigpio so we can set PIGPIO_ADDR/PIGPIO_PORT before the native
// binding initialises. This avoids the native library trying to initialise
// locally (and failing with "Can't lock /var/run/pigpio.pid") if the daemon
// is running only as a TCP service.
let Gpio; // assigned after dynamic import
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
  const btnPin = Number(config.gpio?.audioButton ?? 5);
  const activeHigh = config.gpio?.activeHigh !== false;
  const PULL = (process.env.PULL || 'down').toLowerCase();
  // pressedLevel can be determined without pigpio constants
  const pressedLevel = PULL === 'up' ? 0 : 1; // physical level when button is considered "pressed"

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

  // If pigpiod appears to be present only as a TCP listener (no unix socket)
  // and the process environment doesn't explicitly tell the pigpio C library
  // to use a remote daemon, set PIGPIO_ADDR to the IPv4 forwarder so the
  // native binding uses the daemon client mode instead of local initialisation.
  try {
    const pidExists = fs.existsSync(PID_PATH);
    const sockExists = fs.existsSync(SOCKET_PATH);
    if (pidExists && !sockExists && !process.env.PIGPIO_ADDR) {
      // prefer explicitly configured port if set, otherwise default 8888
      process.env.PIGPIO_ADDR = process.env.PIGPIO_ADDR || '127.0.0.1';
      process.env.PIGPIO_PORT = process.env.PIGPIO_PORT || '8888';
      console.log('[GPIO] detected pigpiod PID without unix socket — setting PIGPIO_ADDR to', process.env.PIGPIO_ADDR);
    }
    if (!pidExists && !sockExists) {
      // prefer explicitly configured port if set, otherwise default 8888
      console.log('[GPIO] detected pigpiod PID — setting PIGPIO_ADDR to', process.env.PIGPIO_ADDR);
    }
  } catch (e) {
    // ignore
  }

  // Import pigpio dynamically so that the environment (PIGPIO_ADDR/PIGPIO_PORT)
  // is already in place when the native binding initialises.
  try {
    // ESM dynamic import
    // eslint-disable-next-line no-await-in-loop
    const pigpioModule = await import('pigpio');
    // pigpio ESM export shape: may be { Gpio } or default export; handle both
    Gpio = pigpioModule.Gpio ?? pigpioModule.default?.Gpio ?? pigpioModule;
  } catch (err) {
    console.warn('[GPIO] pigpio import failed — will attempt pigs CLI fallback:', err?.message || err);
    // if import fails we leave Gpio undefined so the rest of the code will
    // fall back to the pigs CLI in setPump
  }

  // Compute pull-up/down constant only if Gpio is available
  const pud = (Gpio && (PULL === 'up')) ? Gpio.PUD_UP : (Gpio ? Gpio.PUD_DOWN : undefined);

  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      pump = new Gpio(pumpPin, { mode: Gpio.OUTPUT });
      // apply desired pump state at init according to polarity
      const initValue = desiredPumpState ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
      pump.digitalWrite(initValue);

      if (!Gpio) throw new Error('pigpio binding not available');

      audioButton = new Gpio(btnPin, {
        mode: Gpio.INPUT,
        pullUpDown: pud,
        alert: true
      });
      audioButton.glitchFilter(50000);
      audioButton.enableAlert();
      audioButton.on('alert', (level) => {
        // Level is the physical logic level (0 or 1). Depending on pull-up/down wiring
        // the pressed state can be 0 (pull-up, button to GND) or 1 (pull-down).
        try {
          if (level === pressedLevel && typeof audioButtonHandler === 'function') {
            audioButtonHandler();
          }
        } catch (e) {
          // swallow handler errors to avoid crashing the gpio init loop
          console.warn('[GPIO] audioButton handler error:', e?.message || e);
        }
      });

  console.log(`[GPIO] pump@${pumpPin} (out, activeHigh=${activeHigh}), audioButton@${btnPin} (in,alert) using pigpio (pull=${PULL})`);
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
