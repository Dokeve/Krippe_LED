#!/usr/bin/env node
/**
 * led_test_alt_grb.cjs
 * - ALT-only: rpi-ws281x
 * - Fixe GRB-Ausgabe (Order per Software)
 * - Tests:
 *    1) RGB-Blöcke (4 Segmente)
 *    2) Vollweiß
 *    3) Gap-Lauflicht (jede 5. LED an, mehrere Farben)
 *    4) NEU: RGB-Blöcke à 10 LEDs
 *    5) NEU: Segment-Lauflicht: 5 LEDs in einer Farbe wandern (Rot→Grün→Blau→loop)
 * - Optionaler Stopp nach jedem Test via --wait (Enter), sonst --hold <ms>
 * - Logging: Konsole + Datei (--logfile, Default: ./ledtest_alt.log)
 * - ALT-Workaround: KEIN reset() (nur auf schwarz, dann Ende)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------- CLI ----------
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
  lib: 'alt',                                          // erzwungen
  strip: 'grb',                                        // erzwungen
  count: Number(args.count || 150),
  gpio: Number(args.gpio || 12),
  brightness: Number(args.brightness || 128),
  blocksMs: Number(args['blocks-ms'] || 2000),
  wipeMs: Number(args['wipe-ms'] || 20),               // Schrittgeschwindigkeit für Lauflichter
  offMs: Number(args['off-ms'] || 10),
  hold: Number(args.hold || 1000),
  logfile: String(args.logfile || path.resolve(process.cwd(), 'ledtest_alt.log')),
  wait: args.wait === true || String(args.wait || '').toLowerCase() === 'true',
  seg: Number(args.seg || 5),                          // Segmentlänge fürs Segment-Lauflicht
  fixed10: Number(args.fixed10 || 10),                 // Blockgröße für "RGB-Blöcke à 10"
  rounds: Number(args.rounds || 4)                     // Runden für Gap-Lauflicht
};

if (!Number.isInteger(opt.count) || opt.count <= 0) { console.error('count muss > 0 sein'); process.exit(1); }
if (!Number.isInteger(opt.brightness) || opt.brightness < 0 || opt.brightness > 255) { console.error('brightness muss 0..255 sein'); process.exit(1); }

// ---------- Logger ----------
function appendLine(file, line) { try { fs.appendFileSync(file, line + '\n'); } catch {} }
const ts = () => new Date().toISOString();
const log = (...a) => { const line = `${ts()} ${a.join(' ')}`; console.log(line); appendLine(opt.logfile, line); };
const err = (...a) => { const line = `${ts()} ${a.join(' ')}`; console.error(line); appendLine(opt.logfile, line); };

// ---------- ALT-Library ----------
let ws = null;
try { ws = require('rpi-ws281x'); }
catch (e) { err('ALT-Library "rpi-ws281x" nicht gefunden. npm i rpi-ws281x'); process.exit(1); }

// ---------- Guards & Buffers ----------
let initialized = false;
let cleaned = false;
let pixels = new Uint32Array(opt.count);

// ---------- Farbtools (RGB→GRB) ----------
function packGRB(r, g, b) { return ((g & 0xff) << 16) | ((r & 0xff) << 8) | (b & 0xff); }
function colorRGB(r, g, b) { return packGRB(r, g, b); }
const C = {
  R: colorRGB(255, 0, 0),
  G: colorRGB(0, 255, 0),
  B: colorRGB(0, 0, 255),
  Y: colorRGB(255, 255, 0),
  C: colorRGB(0, 255, 255),
  M: colorRGB(255, 0, 255),
  W: colorRGB(255, 255, 255),
  K: colorRGB(0, 0, 0),
};
const COLORS = [C.R, C.G, C.B, C.Y, C.C, C.M, C.W];

function push() {
  if (!initialized || cleaned) return;
  if (typeof ws.render === 'function') ws.render(pixels);
  else if (ws.default && typeof ws.default.render === 'function') ws.default.render(pixels);
}

// ---------- Init / Cleanup ----------
function init() {
  if (initialized) return;
  const cfg = ws.configure || (ws.default && ws.default.configure);
  if (typeof cfg !== 'function') { err('ALT-Lib bietet keine configure().'); process.exit(1); }
  cfg.call(ws, { leds: opt.count, gpio: opt.gpio, brightness: opt.brightness });
  initialized = true;
  log(`[INIT] count=${opt.count} gpio=${opt.gpio} brightness=${opt.brightness} (lib=alt, strip=grb)`);
}

function cleanup(reason = 'exit') {
  if (!initialized || cleaned) return;
  cleaned = true;
  try { pixels.fill(0); push(); } catch (e) { err('[CLEANUP] render->black:', e?.message || e); }
  log(`[CLEANUP] skip reset() für ALT (${reason}) – Prozess endet sauber`);
}

process.once('SIGINT',  () => { err('[SIGNAL] SIGINT');  cleanup('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { err('[SIGNAL] SIGTERM'); cleanup('SIGTERM'); process.exit(0); });
process.once('uncaughtException', (e) => { err('[UNCAUGHT]', e?.stack || e); cleanup('uncaughtException'); process.exit(1); });
process.once('unhandledRejection', (e) => { err('[UNHANDLED REJECTION]', e?.stack || e); cleanup('unhandledRejection'); process.exit(1); });
process.once('exit', (code) => { log(`[EXIT] code=${code}`); cleanup('exit'); });

// ---------- Utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitOrHold(label) {
  if (opt.wait && process.stdin.isTTY) {
    log(`⏸  ${label}: Drücke [Enter], um fortzufahren ...`);
    await new Promise((resolve) => { process.stdin.setEncoding('utf8'); process.stdin.once('data', () => resolve()); });
  } else {
    await sleep(opt.hold);
  }
}

// ---------- Tests ----------

// 1) Frühere RGB-Blöcke (4 Segmente)
async function testBlocks4() {
  log('[TEST] RGB-Blöcke (4 Segmente)');
  const n = opt.count, block = Math.max(1, Math.floor(n / 4));
  pixels.fill(0);
  const setBlock = (i, col) => { const s = i * block, e = Math.min(n, s + block); for (let j = s; j < e; j++) pixels[j] = col; };
  setBlock(0, C.R); setBlock(1, C.G); setBlock(2, C.B); setBlock(3, C.Y);
  push(); await waitOrHold('RGB-Blöcke (4)');
}

// 2) Vollweiß
async function testFullWhite() {
  log('[TEST] Vollweiß');
  pixels.fill(C.W); push(); await waitOrHold('Vollweiß');
}

// 3) Gap-Lauflicht (jede 5. LED an, mehrere Farben, bestehend)
async function testChaserGap(gap = 5, rounds = opt.rounds) {
  log(`[TEST] Gap-Lauflicht – Gap=${gap}, Runden=${rounds}`);
  pixels.fill(0); push();
  const n = opt.count;
  for (let r = 0; r < rounds; r++) {
    const col = COLORS[r % COLORS.length];
    for (let pos = 0; pos < n + gap; pos++) {
      pixels.fill(0);
      for (let i = pos % gap; i < n; i += gap) pixels[i] = col;
      push(); await sleep(opt.wipeMs);
    }
    await sleep(200);
  }
  await waitOrHold('Gap-Lauflicht');
}

// 4) NEU: RGB-Blöcke à fixed10 (Default 10 LEDs pro Farbe)
async function testBlocksFixedSize(size = opt.fixed10) {
  log(`[TEST] RGB-Blöcke à ${size} LEDs (R,G,B,repeat)`);
  const n = opt.count;
  pixels.fill(0);
  for (let i = 0; i < n; i++) {
    const k = Math.floor((i % (size * 3)) / size); // 0..2
    pixels[i] = (k === 0) ? C.R : (k === 1) ? C.G : C.B;
  }
  push(); await waitOrHold(`RGB-Blöcke à ${size}`);
}

// 5) NEU: Segment-Lauflicht: genau seg LEDs in EINER Farbe wandern (R→G→B→loop)
async function testSegmentChaser(seg = opt.seg, colors = [C.R, C.G, C.B], loops = 1) {
  log(`[TEST] Segment-Lauflicht – Segment=${seg}, Farben=${colors.length}, Loops=${loops}`);
  const n = opt.count;
  for (let L = 0; L < loops; L++) {
    for (const col of colors) {
      // von -seg bis n (damit Ein-/Ausschwimmen weich wirkt)
      for (let pos = -seg; pos < n + seg; pos++) {
        pixels.fill(0);
        const start = Math.max(0, pos);
        const end = Math.min(n, pos + seg);
        for (let i = start; i < end; i++) pixels[i] = col;
        push(); await sleep(opt.wipeMs);
      }
      await sleep(200);
    }
  }
  await waitOrHold('Segment-Lauflicht (5er Block)');
}


// 6) NEU: Mehrfarben-Lauflicht – 5 LEDs, je 5 Abstand, feste Farben
async function testMultiColorSpaced(gap = 5) {
  log(`[TEST] Mehrfarben-Lauflicht – 5 LEDs mit Abstand=${gap}`);

  const n = opt.count;
  const palette = [C.R, C.B, C.Y, C.G, C.W]; // Rot, Blau, Gelb, Grün, Weiß
  const num = palette.length;

  // wir lassen die gesamte Sequenz "durchlaufen"
  for (let pos = 0; pos < n + gap * num; pos++) {
    pixels.fill(0);

    for (let i = 0; i < num; i++) {
      const idx = pos + i * gap;
      if (idx >= 0 && idx < n) {
        pixels[idx] = palette[i];
      }
    }

    push();
    await sleep(opt.wipeMs);
  }

  await waitOrHold('Mehrfarben-Lauflicht (5 LEDs mit Abstand)');
}


// ---------- Main ----------
;(async function main() {
  log(`[LIB] verwendet: alt (rpi-ws281x)`);
  log('== ALT-GRB-LED-Test ==');
  log(`Host=${os.hostname()}  LEDs=${opt.count}  GPIO=${opt.gpio}  Brightness=${opt.brightness}  Strip=grb  Wait=${opt.wait ? 'Enter' : (opt.hold + 'ms')}`);
  log(`Logfile=${opt.logfile}`);

  try { fs.mkdirSync(path.dirname(opt.logfile), { recursive: true }); } catch {}

  init();

  await testBlocks4();
  await testFullWhite();
  await testChaserGap(5, opt.rounds);        // bestehender Gap-Chaser
  await testBlocksFixedSize(opt.fixed10);    // NEU: RGB-Blöcke à 10
  await testSegmentChaser(opt.seg, [C.R, C.G, C.B], 4); // NEU: Segment-Lauflicht; 2 Loops
  await testMultiColorSpaced(5); // NEU: Mehrfarben-Lauflicht


  pixels.fill(0); push();
  log('== Ende ==');
  cleanup('normal-end');
  process.exit(0);
})().catch(e => {
  err('[MAIN]', e?.stack || e);
  cleanup('main-catch');
  process.exit(1);
});
