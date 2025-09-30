// led_strip_full_autotest_manual.js
// Testet nacheinander verschiedene StripTypes und GPIO-Pins – mit manueller Bestätigung

const ws = require('rpi-ws281x');
const readline = require('readline');

const LEDS = parseInt(process.argv[2] || "62", 10);   // Anzahl LEDs
const BRIGHTNESS = parseInt(process.argv[3] || "200", 10);

// Beliebte GPIO-Pins für WS281x
const GPIO_PINS = [12, 18, 13, 19];

const STRIP_TYPES = [
  'ws2812', 'ws2812_rbg', 'ws2812_brg', 'ws2812_grb',
  'sk6812', 'sk6812_rbg', 'sk6812_brg', 'sk6812_grb',
  'ws2811_rgb', 'ws2811_rbg', 'ws2811_brg', 'ws2811_grb'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function promptEnter(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(msg, () => { rl.close(); resolve(); }));
}

async function testType(gpio, type) {
  console.log(`   ⚡ StripType: ${type}`);
  try {
    ws.configure({ leds: LEDS, gpio, brightness: BRIGHTNESS, stripType: type });

    const pixels = new Uint32Array(LEDS);

    // Vollfläche Grün
    pixels.fill(0x00ff00);
    ws.render(pixels);
    await sleep(500);

    // Vollfläche Rot
    pixels.fill(0xff0000);
    ws.render(pixels);
    await sleep(500);

    // Lauflicht Blau
    for (let i = 0; i < LEDS; i++) {
      pixels.fill(0);
      pixels[i] = 0x0000ff;
      ws.render(pixels);
      await sleep(20);
    }

  } catch (err) {
    console.error(`   ❌ Fehler bei ${type} auf GPIO ${gpio}:`, err.message);
  } finally {
    ws.reset();
    await sleep(300);
  }
}

(async () => {
  console.log(`== LED Full-AutoTest (manuell) ==`);
  console.log(`LEDs=${LEDS}  Brightness=${BRIGHTNESS}`);
  console.log(`GPIOs=${GPIO_PINS.join(", ")}`);

  for (const gpio of GPIO_PINS) {
    console.log(`\n➡️ Teste GPIO ${gpio} ...`);
    console.log(`Bitte LED-Datenleitung an GPIO ${gpio} anschließen.`);
    await promptEnter("   Drücke [Enter], wenn angeschlossen und bereit...\n");

    for (const type of STRIP_TYPES) {
      await testType(gpio, type);
      await promptEnter("   Weiter mit nächstem StripType? [Enter]\n");
    }
    console.log(`➡️ Fertig mit GPIO ${gpio}.`);
  }

  console.log("\n✅ Vollständiger Auto-Test abgeschlossen.");
  console.log("Falls kein Licht kam: Stromversorgung / GND / Levelshifter prüfen.");
})();
