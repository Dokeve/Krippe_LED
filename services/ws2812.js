// services/ws2812.js
// Steuerung der WS281x-LEDs über die Bibliothek `rpi-ws281x`.
import config from '../config.js';

let driver = null;          // Geladene rpi-ws281x-Instanz
let initialized = false;    // Ob configure() bereits ausgeführt wurde
let numLEDs = 0;            // Aktuell konfigurierte LED-Anzahl
let pixelData = null;       // Gemeinsamer Pixelpuffer (Uint32Array)

function packColor(hex) {
  const value = parseInt((hex || '#000000').slice(1), 16) >>> 0;
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  switch ((config.led.order || 'GRB').toUpperCase()) {
    case 'RGB': return (r << 16) | (g << 8) | b;
    case 'RBG': return (r << 16) | (b << 8) | g;
    case 'GRB': return (g << 16) | (r << 8) | b;
    case 'GBR': return (g << 16) | (b << 8) | r;
    case 'BRG': return (b << 16) | (r << 8) | g;
    case 'BGR': return (b << 16) | (g << 8) | r;
    default:    return (g << 16) | (r << 8) | b;
  }
}

async function loadDriver() {
  if (driver !== null) return driver;
  try {
    const mod = await import('rpi-ws281x');
    driver = mod?.default || mod;
  } catch (error) {
    console.warn('[WS2812] rpi-ws281x konnte nicht geladen werden – Simulation aktiv.', error?.message || error);
    driver = false;
  }
  return driver;
}

export async function initLEDs(count = config.led.count) {
  const ws = await loadDriver();
  if (!ws) return;

  const target = Math.max(1, Number(count) || 1);
  if (initialized && numLEDs === target && pixelData instanceof Uint32Array) {
    return;
  }

  if (typeof ws.configure !== 'function') {
    throw new Error('rpi-ws281x bietet keine configure()-Funktion.');
  }

  numLEDs = target;
  pixelData = new Uint32Array(numLEDs);

  ws.configure({ leds: numLEDs, gpio: config.led.gpio, brightness: config.led.brightness });
  initialized = true;
  console.log(`[WS2812] init: ${numLEDs} LEDs @ GPIO ${config.led.gpio} (Brightness ${config.led.brightness}) order=${config.led.order || 'GRB'}`);
}

export function setPixel(index, hex) {
  if (!pixelData || index < 0 || index >= numLEDs) return;
  pixelData[index] = packColor(hex);
}

export function fillRange(a, b, hex) {
  if (!pixelData) return;
  const start = Math.max(0, Math.min(a, b));
  const end = Math.min(numLEDs - 1, Math.max(a, b));
  const value = packColor(hex);
  for (let i = start; i <= end; i += 1) pixelData[i] = value;
}

export function clear() {
  if (!pixelData) return;
  pixelData.fill(0);
  render();
}

export function render() {
  if (!pixelData || !initialized || !driver) return;
  try {
    driver.render(pixelData);
  } catch (error) {
    console.error('[WS2812] render-Fehler:', error);
  }
}

export async function shutdownLEDs() {
  if (!initialized || !driver) return;
  try {
    pixelData?.fill(0);
    render();
    if (typeof driver.reset === 'function') {
      driver.reset();
    }
  } finally {
    initialized = false;
    console.log('[WS2812] Shutdown abgeschlossen');
  }
}

export function getCount() {
  return numLEDs;
}

export default {
  initLEDs,
  setPixel,
  fillRange,
  clear,
  render,
  shutdownLEDs,
  get count() {
    return getCount();
  }
};
