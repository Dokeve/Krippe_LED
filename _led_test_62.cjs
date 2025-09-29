/**
 * _led_test_62.cjs
 * Testet 62 LEDs: Farben in 10er Blöcken Rot -> Grün -> Blau -> Gelb, wiederholt sich.
 * CommonJS (require), damit es unabhängig von "type": "module" läuft.
 */
const LED_COUNT = 62;
const GPIO_PIN = 18;
const BRIGHTNESS = 64;

function toGRB(hex) {
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

const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00].map(toGRB);

if (mode === 'native') {
  ws.init(LED_COUNT, { gpioPin: GPIO_PIN, brightness: BRIGHTNESS });
} else {
  ws.configure({ leds: LED_COUNT, gpio: GPIO_PIN, brightness: BRIGHTNESS });
}

const arr = new Uint32Array(LED_COUNT);
for (let i = 0; i < LED_COUNT; i++) {
  const block = Math.floor(i / 10);
  arr[i] = COLORS[block % COLORS.length];
}

ws.render(arr);
setTimeout(() => {
  try { ws.reset(); } catch {}
  console.log('LED-Test OK (Modus:', mode, ')');
  process.exit(0);
}, 1500);
