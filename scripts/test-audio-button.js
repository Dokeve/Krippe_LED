// scripts/test-audio-button.js
import pigpio from 'pigpio';
const { Gpio } = pigpio;

// Configure via env vars:
// BUTTON_PIN - BCM pin number (default 17)
// PULL - 'up' or 'down' to set internal pull resistor for testing (default 'down')
const PIN = process.env.BUTTON_PIN ? parseInt(process.env.BUTTON_PIN, 10) : 5; // BCM pin
const PULL = (process.env.PULL || 'down').toLowerCase();
const pud = PULL === 'up' ? Gpio.PUD_UP : Gpio.PUD_DOWN;

console.log('Using pin', PIN, 'with pull', PULL);
try {
  const btn = new Gpio(PIN, { mode: Gpio.INPUT, pullUpDown: pud, alert: true });
  // read initial level if available
  try {
    const startLevel = btn.digitalRead();
    console.log('Initial level (digitalRead):', startLevel);
  } catch (e) {
    // ignore if digitalRead isn't available for some reason
  }

  btn.on('alert', (level, tick) => {
    console.log(new Date().toISOString(), 'alert level=', level, 'tick=', tick);
  });
  console.log('Listening for alerts. Press Ctrl+C to exit.');
} catch (err) {
  console.error('Error initialising pigpio Gpio:', err.message || err);
  console.error('Tip: prüfe mit `sudo systemctl status pigpiod` und `pigs r <pin>`');
}