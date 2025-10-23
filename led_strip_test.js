#!/usr/bin/env node
/**
 * LED-Minimaltest für WS2812/ SK6812 am Raspberry Pi
 * - Probiert beide Libraries: rpi-ws281x-native -> rpi-ws281x (Fallback)
 * - Testet mehrere stripType-Varianten: ws2812_grb, ws2812_rgb, sk6812
 * - Muster: Vollfläche, Lauflicht, Regenbogen
 *
 * Aufrufbeispiel:
 *   sudo node led_strip_test.js --leds 62 --gpio 12 --brightness 200
 */

const args = require('node:process').argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const LEDS = parseInt(getArg('leds', '62'), 10);
const GPIO = parseInt(getArg('gpio', '12'), 10);
const BRIGHTNESS = Math.max(0, Math.min(255, parseInt(getArg('brightness', '200'), 10)));

const STRIP_TYPES = ['ws2812_grb', 'ws2812_rgb', 'sk6812'];

let driver = null;
let api = null; // 'native' oder 'alt'
let pixelData = new Uint32Array(LEDS);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toColor(r, g, b) {
  // In beiden Libs ist 0xRRGGBB gängig; Byte-Reihenfolge regelt stripType
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

// Muster
function fill(color) {
  pixelData.fill(color);
  driver.render(pixelData);
}
async function chase(colors, segment = 10, stepMs = 60) {
  for (let i = 0; i < LEDS + segment * colors.length; i++) {
    pixelData.fill(0);
    for (let c = 0; c < colors.length; c++) {
      const start = i - c * segment;
      for (let k = 0; k < segment; k++) {
        const idx = start + k;
        if (idx >= 0 && idx < LEDS) pixelData[idx] = colors[c];
      }
    }
    driver.render(pixelData);
    await sleep(stepMs);
  }
}
async function rainbow(cycles = 1, stepMs = 25) {
  const n = LEDS;
  for (let t = 0; t < 256 * cycles; t++) {
    for (let i = 0; i < n; i++) {
      const p = (i * 256 / n + t) & 255;
      let r, g, b;
      if (p < 85)        { r = p * 3; g = 255 - p * 3; b = 0; }
      else if (p < 170)  { const q = p - 85; r = 255 - q * 3; g = 0; b = q * 3; }
      else               { const q = p - 170; r = 0; g = q * 3; b = 255 - q * 3; }
      pixelData[i] = toColor(r, g, b);
    }
    driver.render(pixelData);
    await sleep(stepMs);
  }
}

// Treiber initialisieren — erst native, dann Fallback
function tryLoadNative(stripType) {
  const ws = require('rpi-ws281x-native');
  ws.init(LEDS, { gpioPin: GPIO, brightness: BRIGHTNESS, stripType });
  return {
    render: (arr) => ws.render(arr),
    reset: () => ws.reset(),
    name: `rpi-ws281x-native (${stripType})`
  };
}

function tryLoadAlt(stripType) {
  const ws = require('rpi-ws281x');
  ws.configure({ leds: LEDS, gpio: GPIO, brightness: BRIGHTNESS, stripType });
  return {
    render: (arr) => ws.render(arr),
    reset: () => ws.reset(),
    name: `rpi-ws281x (alt) (${stripType})`
  };
}

async function main() {
  if (process.getuid && process.getuid() !== 0) {
    console.warn('⚠️ Bitte mit root-Rechten starten: sudo node led_strip_test.js ...');
  }
  console.log(`\n== LED-Test ==\nLEDs=${LEDS}  GPIO=${GPIO}  Brightness=${BRIGHTNESS}\n`);

  for (const stripType of STRIP_TYPES) {
    for (const which of ['native', 'alt']) {
      try {
        driver = which === 'native' ? tryLoadNative(stripType) : tryLoadAlt(stripType);
        api = which;
        console.log(`✅ Initialisiert mit ${driver.name}`);

        // Muster 1: Vollfläche Grün 1.5s
        console.log('→ Vollfläche: Grün');
        fill(toColor(0, 255, 0));
        await sleep(1500);

        // Muster 2: Lauflicht 10er-Segmente RGBY
        console.log('→ Lauflicht: 10er-Segmente (Rot, Grün, Blau, Gelb)');
        await chase([toColor(255,0,0), toColor(0,255,0), toColor(0,0,255), toColor(255,255,0)], 10, 50);

        // Muster 3: Kurzer Regenbogen
        console.log('→ Regenbogen kurz');
        await rainbow(1, 15);

        // Off und Reset
        fill(0);
        await sleep(200);
        driver.reset();
        console.log('✅ Test abgeschlossen.\n');
        return;
      } catch (e) {
        console.warn(`❌ Init fehlgeschlagen mit ${which} / ${stripType}: ${e.message}`);
        try { if (driver) driver.reset(); } catch {}
        driver = null;
      }
    }
  }

  console.error('\n❌ Keine der Kombinationen hat initialisiert. Prüfpunkte:');
  console.error('- Richtige GPIO-Nummer (12) und +5V/GND?');
  console.error('- Gemeinsame Masse zwischen Netzteil und Raspberry?');
  console.error('- Level-Shifter (74AHCT125/74HCT245) zwischen Pi (3,3 V) und Datenleitung?');
  console.error('- Erste LED zeigt Pfeilrichtung von DIN nach DOUT (richtig herum)?');
  console.error('- Anderen stripType probiert (Script hat schon durchprobiert)?');
  console.error('- Keine konkurrierenden Dienste (Audio-PWM-Treiber, andere LED-Apps)?');
  process.exit(1);
}

process.on('SIGINT', () => { try { if (driver) driver.reset(); } catch {}; process.exit(0); });
main();
