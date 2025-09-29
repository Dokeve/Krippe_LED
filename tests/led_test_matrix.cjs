#!/usr/bin/env node
/**
 * led_test_matrix.cjs — stabile Variante ohne Re-Konfiguration
 * - CommonJS
 * - Einmalige Init/Reset (Guarded)
 * - Strip-Order per Software (Kanäle permutieren), nicht per Hardware-Option
 * - process.once Handler, keine mehrfachen Signals
 * - Library Mapping (fest):
 *     --lib alt     => rpi-ws281x
 *     --lib native  => rpi-ws281x-native
 *
 * Beispiel:
 *   sudo -E MALLOC_CHECK_=3 node --trace-uncaught led_test_matrix.cjs \
 *     --count 200 --brightness 255 --gpio 12 --lib alt --strip auto \
 *     >> /home/singer/ledtest.log 2>&1
 */

const os = require('os');

// ---------- kleine CLI-Parser-Hilfe ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      out[k] = v;
    } else {
      (out._ || (out._ = [])).push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const opt = {
  lib: String(args.lib || 'alt'),          // alt | native
  strip: String(args.strip || 'auto'),     // auto | grb | rgb | bgr | gbr
  count: Number(args.count || 150),
  gpio: Number(args.gpio || 12),
  brightness: Number(args.brightness || 128),
  blocksMs: Number(args['blocks-ms'] || 2000),
  wipeMs: Number(args['wipe-ms'] || 20),
  offMs: Number(args['off-ms'] || 10),
  hold: Number(args.hold || 1000),
};

if (!Number.isInteger(opt.count) || opt.count <= 0) {
  console.error('count muss > 0 sein'); process.exit(1);
}
if (!Number.isInteger(opt.brightness) || opt.brightness < 0 || opt.brightness > 255) {
  console.error('brightness muss 0..255 sein'); process.exit(1);
}

// ---------- Logging ----------
const ts = () => new Date().toISOString();
const log = (...a) => console.log(ts(), ...a);
const err = (...a) => console.error(ts(), ...a);

// ---------- Lib laden (festes Mapping alt/native) ----------
let ws = null;
let which = null;

function tryRequire(name) {
  try { return require(name); } catch (_) { return null; }
}

function loadLib(whichWanted) {
  if (whichWanted === 'native') {
    ws = tryRequire('rpi-ws281x-native');
    if (!ws) {
      err('Library "rpi-ws281x-native" nicht gefunden. Installiere sie oder nutze --lib alt.');
      process.exit(1);
    }
    which = 'native';
    return;
  }
  // alt (Standard): rpi-ws281x
  ws = tryRequire('rpi-ws281x');
  if (!ws) {
    err('Library "rpi-ws281x" nicht gefunden. Installiere sie (npm i rpi-ws281x) oder nutze --lib native.');
    process.exit(1);
  }
  which = 'alt';
}

loadLib(opt.lib);
log(`[LIB] verwendet: ${which} (${which === 'alt' ? 'rpi-ws281x' : 'rpi-ws281x-native'})`);

// ---------- Guard-Flags ----------
let initialized = false;
let cleaned = false;
let pixels = new Uint32Array(opt.count);

// --------- Farb-Tools (Software-Order) ----------
function packRGB(r, g, b) {
  // Hardware erwartet meist GRB; wir liefern final GRB an die Lib.
  return ((g & 0xff) << 16) | ((r & 0xff) << 8) | (b & 0xff);
}

function permuteRGBForOrder(r, g, b, order) {
  switch (order) {
    case 'rgb': return [r, g, b];
    case 'grb': return [g, r, b];
    case 'bgr': return [b, g, r];
    case 'gbr': return [g, b, r];
    default:    return [r, g, b];
  }
}

function colorWithOrder(r, g, b, order) {
  const [rr, gg, bb] = permuteRGBForOrder(r, g, b, order);
  return packRGB(rr, gg, bb);
}

function push() {
  if (!initialized || cleaned) return; // nie nach cleanup rendern
  if (typeof ws.render === 'function') ws.render(pixels);
  else if (ws.default && typeof ws.default.render === 'function') ws.default.render(pixels);
}

// ---------- Init / Cleanup ----------

function init() {
  if (initialized) return;

  if (which === 'alt') {
    // ALT = rpi-ws281x → configure(...)
    const cfg = ws.configure || (ws.default && ws.default.configure);
    if (typeof cfg !== 'function') {
      err('ALT-Lib (rpi-ws281x) bietet weder configure() noch init(). API prüfen.');
      process.exit(1);
    }

    // Minimal-Konfiguration (Order machen wir per Software, daher kein stripType nötig)
    cfg.call(ws, {
      leds: opt.count,
      gpio: opt.gpio,
      brightness: opt.brightness,
      // stripType: 'grb', // optional – wir permutieren ohnehin in Software
    });

    // Manche Versionen haben keine separate setBrightness()
    // -> nix weiter nötig, render() akzeptiert weiterhin Uint32Array
  } else {
    // NATIVE = rpi-ws281x-native → init(...)
    const initFn = ws.init || (ws.default && ws.default.init);
    const setBrightness = ws.setBrightness || (ws.default && ws.default.setBrightness);

    if (typeof initFn !== 'function') {
      err('Native-Lib (rpi-ws281x-native) ohne init(). API prüfen.');
      process.exit(1);
    }

    initFn.call(ws, opt.count, { gpioPin: opt.gpio, brightness: opt.brightness });
    if (typeof setBrightness === 'function') setBrightness.call(ws, opt.brightness);
  }

  initialized = true;
  log(`[INIT] count=${opt.count} gpio=${opt.gpio} brightness=${opt.brightness} (lib=${which})`);
}




function cleanup(reason = 'exit') {
  if (!initialized || cleaned) return;
  cleaned = true;

  try {
    // Alles aus
    pixels.fill(0);
    push();
  } catch (e) {
    err('[CLEANUP] render->black:', e && e.message || e);
  }

  // WICHTIG:
  // ALT (rpi-ws281x) crasht in ws2811_cleanup → reset() NICHT aufrufen!
  // NATIV (rpi-ws281x-native) ist okay → reset() weiterhin nutzen.
  try {
    const isAlt = which === 'alt'; // alt = rpi-ws281x, native = rpi-ws281x-native
    if (!isAlt) {
      const resetFn = ws.reset || (ws.default && ws.default.reset) || ws.finalize || (ws.default && ws.default.finalize);
      if (typeof resetFn === 'function') resetFn.call(ws);
      log(`[CLEANUP] reset/finalize OK (${reason}) [native]`);
    } else {
      // Workaround für ALT: KEIN reset(), nur kurze Pause
      // (DMA/PWM kann noch senden; die Pause sorgt für elegantes Auslaufen)
      log(`[CLEANUP] skip reset() für ALT (${reason}) – Workaround gegen double-free`);
    }
  } catch (e) {
    err('[CLEANUP] reset/finalize:', e && e.message || e);
  }
}



// ---------- Signal/Exit-Handler (einmalig) ----------
process.once('SIGINT',  () => { err('[SIGNAL] SIGINT');  cleanup('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { err('[SIGNAL] SIGTERM'); cleanup('SIGTERM'); process.exit(0); });
process.once('uncaughtException', (e) => { err('[UNCAUGHT]', e && e.stack || e); cleanup('uncaughtException'); process.exit(1); });
process.once('unhandledRejection', (e) => { err('[UNHANDLED REJECTION]', e && e.stack || e); cleanup('unhandledRejection'); process.exit(1); });
process.once('exit', (code) => { log(`[EXIT] code=${code}`); cleanup('exit'); });

// ---------- Patterns ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function patternBlocks(order) {
  log(`[PATTERN] Blocks (${order})`);
  const n = opt.count;
  const q = Math.max(1, Math.floor(n / 4));
  pixels.fill(0);
  const setBlock = (i, col) => {
    const s = i * q, e = Math.min(n, s + q);
    for (let j = s; j < e; j++) pixels[j] = col;
  };
  setBlock(0, colorWithOrder(255,   0,   0, order)); // Rot
  setBlock(1, colorWithOrder(  0, 255,   0, order)); // Grün
  setBlock(2, colorWithOrder(  0,   0, 255, order)); // Blau
  setBlock(3, colorWithOrder(255, 255,   0, order)); // Gelb
  push(); await sleep(opt.blocksMs);
}

async function patternWipeToWhite(order) {
  log(`[PATTERN] Wipe→Weiß (${order})`);
  pixels.fill(0);
  for (let i = 0; i < opt.count; i++) {
    pixels[i] = colorWithOrder(255, 255, 255, order);
    if ((i & 7) === 0) push();
    await sleep(opt.offMs);
  }
  push(); await sleep(300);
}

async function patternFullWhite(order) {
  log(`[PATTERN] FullWhite (${order})`);
  pixels.fill(colorWithOrder(255, 255, 255, order));
  push(); await sleep(500);
}

async function patternBlack() {
  log('[PATTERN] Schwarz');
  pixels.fill(0); push(); await sleep(200);
}

// ---------- Main ----------
(async function main() {
  log('== LED Test (stabil, ohne Re-Config) ==');
  log(`Host=${os.hostname()}  LEDs=${opt.count}  GPIO=${opt.gpio}  Brightness=${opt.brightness}  Lib=${which}  Strip=${opt.strip}`);

  init();

  // Orders festlegen
  let orders = ['grb'];
  if (opt.strip === 'auto') orders = ['grb','rgb','bgr','gbr'];
  else orders = [opt.strip];

  for (const order of orders) {
    await patternBlocks(order);
    await patternWipeToWhite(order);
    await patternFullWhite(order);
    await patternBlack();
    await sleep(opt.hold);
  }

  log('== Ende ==');
  cleanup('normal-end');
  process.exit(0);
})().catch(e => {
  err('[MAIN]', e && e.stack || e);
  cleanup('main-catch');
  process.exit(1);
});
