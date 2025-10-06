// services/ws2812.js
// Steuerung der WS2812-LEDs über die ALT-Library `rpi-ws281x` (GRB).
let driver = null;          // geladene rpi-ws281x Instanz
let initialized = false;    // merkt, ob configure() bereits ausgeführt wurde
let numLEDs = 0;            // aktuell konfigurierte LED-Anzahl
let pixelData = null;       // gemeinsamer Pixelpuffer (Uint32Array)
const gpioPin = 12;         // GPIO für WS2812 (Pin 32)
let brightness = 128;       // Standardhelligkeit 0..255

function hexToGRB(hex) {
  const v = parseInt((hex || '#000000').slice(1), 16) >>> 0;
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return (g << 16) | (r << 8) | b;
}

async function loadDriver() {
  if (driver !== null) return driver;
  try {
    const mod = await import('rpi-ws281x');
    driver = mod?.default || mod;
  } catch (err) {
    console.warn('[WS2812] rpi-ws281x konnte nicht geladen werden – Simulation aktiv.', err?.message || err);
    driver = false;
  }
  return driver;
}

export async function initLEDs(count = 1000) {
  const ws = await loadDriver();
  if (!ws) return; // Simulation

  const target = Math.max(1, Number(count) || 1);
  if (initialized && numLEDs === target && pixelData instanceof Uint32Array) {
    return;
  }

  if (typeof ws.configure !== 'function') {
    throw new Error('rpi-ws281x bietet keine configure()-Funktion (ALT-Version erforderlich)');
  }

  numLEDs = target;
  pixelData = new Uint32Array(numLEDs);

  ws.configure({ leds: numLEDs, gpio: gpioPin, brightness });
  initialized = true;
  console.log(`[WS2812] init: ${numLEDs} LEDs @ GPIO ${gpioPin} (Brightness ${brightness})`);
}

export function setPixel(index, hex) {
  if (!pixelData || index < 0 || index >= numLEDs) return;
  pixelData[index] = hexToGRB(hex);
}

export function fillRange(a, b, hex) {
  if (!pixelData) return;
  const start = Math.max(0, Math.min(a, b));
  const end = Math.min(numLEDs - 1, Math.max(a, b));
  const value = hexToGRB(hex);
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
