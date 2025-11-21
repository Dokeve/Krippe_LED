// services/gpio.js
// Minimal pigpio-client adapter (ESM).
// Exports: initGpio(), setPump(on), onAudioButton(cb)

import config from '../config.js';

let client = null;
let pumpGpio = null;
let btnGpio = null;
let pumpPin = null;
let btnPin = null;
let desiredPumpState = false;
let audioButtonHandler = null;

export async function initGpio() {
  // compute config values
  pumpPin = Number(config.gpio?.pump ?? 22);
  btnPin = Number(config.gpio?.audioButton ?? 17);
  const activeHigh = config.gpio?.activeHigh !== false;
  const PULL = (process.env.PULL || 'down').toLowerCase();
  const pressedLevel = PULL === 'up' ? 0 : 1;

  const host = process.env.PIGPIO_ADDR || '127.0.0.1';
  const port = Number(process.env.PIGPIO_PORT || 8888);

  console.log(`[GPIO] init config pump=${pumpPin} btn=${btnPin} PULL=${PULL} activeHigh=${activeHigh} host=${host} port=${port}`);

  // helper: validate BCM GPIO number
  const isValidGpio = (n) => Number.isInteger(n) && n >= 0 && n <= 53;

  let mod;
  try {
    mod = await import('pigpio-client');
  } catch (err) {
    console.error('[GPIO] failed to import pigpio-client:', err && err.message ? err.message : err);
    return;
  }

  const pigpioFactory = mod.pigpio ?? mod.default?.pigpio;
  if (!pigpioFactory) {
    console.error('[GPIO] pigpio-client factory not found in module exports');
    return;
  }

  client = pigpioFactory({ host, port });

  // wait for connected before creating gpio objects to avoid race conditions
  client.once('connected', (info) => {
    console.log('[GPIO] pigpio-client connected info:', JSON.stringify(info));

    client.on('error', (err) => console.warn('[GPIO] pigpio-client error:', err && err.message ? err.message : err));

    // Pump GPIO: create + configure
    if (!isValidGpio(pumpPin)) {
      console.warn(`[GPIO] pump pin ${pumpPin} is not a valid gpio number, skipping pump setup`);
      pumpGpio = null;
    } else {
      try {
        pumpGpio = client.gpio(pumpPin);
        if (typeof pumpGpio.modeSet === 'function') pumpGpio.modeSet('output');
        const initValue = desiredPumpState ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);
        if (typeof pumpGpio.write === 'function') pumpGpio.write(initValue);
      } catch (err) {
        console.error('[GPIO] pump gpio initialization failed:', err && err.message ? err.message : err);
        pumpGpio = null;
      }
    }

    // Button GPIO: create + configure
    if (!isValidGpio(btnPin)) {
      console.warn(`[GPIO] button pin ${btnPin} is not a valid gpio number, skipping button setup`);
      btnGpio = null;
    } else {
      try {
        btnGpio = client.gpio(btnPin);
        if (typeof btnGpio.modeSet === 'function') btnGpio.modeSet('input');

        if (typeof btnGpio.pullUpDown === 'function') {
          const pudVal = PULL === 'up' ? 2 : PULL === 'down' ? 1 : 0;
          btnGpio.pullUpDown(pudVal, () => {
            console.log(`[GPIO] pullUpDown set to ${PULL} (pud=${pudVal}) for btn=${btnPin}`);
            try {
              if (typeof btnGpio.digitalRead === 'function') {
                const lvl = btnGpio.digitalRead();
                console.log(`[GPIO] btn=${btnPin} digitalRead => ${lvl}`);
              } else if (typeof btnGpio.read === 'function') {
                const maybe = btnGpio.read();
                if (maybe && typeof maybe.then === 'function') {
                  maybe.then(lvl => console.log(`[GPIO] btn=${btnPin} read() => ${lvl}`)).catch(()=>{});
                } else {
                  console.log(`[GPIO] btn=${btnPin} read() => ${maybe}`);
                }
              }
            } catch (e) {}
          });
        } else {
          console.log('[GPIO] btnGpio.pullUpDown not supported by client');
        }

        const notifyHandler = (level, tick) => {
          console.log(`[GPIO] pigpio-client notify btn=${btnPin} level=${level} tick=${tick}`);
          if (level === pressedLevel && typeof audioButtonHandler === 'function') audioButtonHandler();
        };

        if (typeof btnGpio.notify === 'function') {
          btnGpio.notify(notifyHandler);
        } else if (typeof btnGpio.on === 'function') {
          btnGpio.on('alert', notifyHandler);
        } else {
          console.log('[GPIO] btnGpio does not support notify/on; no button events registered');
        }
      } catch (err) {
        console.error('[GPIO] button gpio initialization failed:', err && err.message ? err.message : err);
        btnGpio = null;
      }
    }

    console.log(`[GPIO] using pigpio-client ${host}:${port} pump=${pumpPin} btn=${btnPin}`);
  });

  client.on('error', (err) => console.warn('[GPIO] pigpio-client error:', err && err.message ? err.message : err));
}

export function setPump(on) {
  desiredPumpState = !!on;
  const activeHigh = config.gpio?.activeHigh !== false;
  const value = on ? (activeHigh ? 1 : 0) : (activeHigh ? 0 : 1);

  if (pumpGpio && typeof pumpGpio.write === 'function') {
    pumpGpio.write(value);
    console.log(`[GPIO] setPump -> gpio.write ${pumpPin}=${value}`);
    return;
  }

  if (client && typeof client.digitalWrite === 'function') {
    try {
      client.digitalWrite(pumpPin, value);
      console.log(`[GPIO] setPump -> digitalWrite ${pumpPin}=${value}`);
      return;
    } catch (e) {
      // fall through to warning below
    }
  }

  console.warn('[GPIO] setPump: no gpio client available to write');
}

export function onAudioButton(cb) {
  audioButtonHandler = typeof cb === 'function' ? cb : null;
}
