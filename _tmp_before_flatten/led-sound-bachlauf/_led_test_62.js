/**
 * _led_test_62.js
 * Testet 62 LEDs: Farben in 10er Blöcken Rot -> Grün -> Blau -> Gelb, wiederholt sich.
 * Nutzt bevorzugt 'rpi-ws281x-native', fällt zurück auf 'rpi-ws281x'.
 */
const LED_COUNT = 62;
const GPIO_PIN = 18;
const BRIGHTNESS = 64;

function toGRB(hex) {
  // Module erwarten i.d.R. GRB (prüfen wir nicht dynamisch; reicht für Test)
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (g << 16) | (r << 8) | b;
}

let ws = null;
let mode = null;
try {
  ws = require('rpi-ws281x-native');
  mode = 'native';
} catch {
  ws = require('rpi-ws281x');
  mode = 'alt';
}

const COLORS = [
  0xff0000, // Rot
  0x00ff00, // Grün
  0x0000ff, // Blau
  0xffff00, // Gelb
].map(toGRB);

if (mode === 'native') {
  ws.init(LED_COUNT, { gpioPin: GPIO_PIN, brightness: BRIGHTNESS });
} else {
  ws.configure({ leds: LED_COUNT, gpio: GPIO_PIN, brightness: BRIGHTNESS });
}

const arr = new Uint32Array(LED_COUNT);
for (let i = 0; i < LED_COUNT; i++) {
  const block = Math.floor(i / 10);        // 10er-Schritte
  const colorIdx = block % COLORS.length;  // zyklisch RGBy
  arr[i] = COLORS[colorIdx];
}

ws.render(arr);
setTimeout(() => {
  try { ws.reset(); } catch {}
  console.log('LED-Test OK (Modus:', mode, ')');
  process.exit(0);
}, 1500);
