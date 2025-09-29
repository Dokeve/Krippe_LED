import config from '../config.js';
import { getDB } from './db.js';
import { Log } from './log.js';
import ws281x from 'rpi-ws281x';

let pixels = null;
let inited = false;

function toRGB(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || 'ffffff');
  const intVal = parseInt(m ? m[1] : 'ffffff', 16);
  return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
}
function pack({ r, g, b }) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function init() {
  if (inited) return;
  const numLeds = Number(config.led.totalLeds);
  pixels = new Uint32Array(numLeds);

  ws281x.configure({
    leds: numLeds,
    gpio: config.led.gpioPin,
    brightness: config.led.brightness,
    dma: config.led.dma,
    stripType: 'grb',
  });

  clearAll();
  inited = true;
  Log.success(`WS2812 initialisiert: ${numLeds} LEDs @ GPIO ${config.led.gpioPin}`);
}

export function clearAll() {
  if (!pixels) return;
  pixels.fill(0);
  ws281x.render(pixels);
}

export function setAll(hex) {
  if (!inited) init();
  const val = pack(toRGB(hex));
  pixels.fill(val);
  ws281x.render(pixels);
  Log.info(`Alle LEDs -> ${hex}`);
}

export function off() {
  if (!inited) init();
  clearAll();
  ws281x.render(pixels);
  Log.info('LEDs aus');
}

export function setGroup(name, hex) {
  if (!inited) init();
  const db = getDB();
  const row = db.prepare('SELECT * FROM led_groups WHERE name = ?').get(name);
  if (!row) throw new Error('Gruppe nicht gefunden: ' + name);
  const val = pack(toRGB(hex));
  for (let i = 0; i < row.length; i++) {
    const idx = row.start_index + i;
    if (idx >= 0 && idx < pixels.length) pixels[idx] = val;
  }
  ws281x.render(pixels);
  db.prepare('UPDATE led_groups SET color = ? WHERE id = ?').run(hex, row.id);
  Log.info(`Gruppe "${name}" -> ${hex}`);
}
