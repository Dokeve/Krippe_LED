// led-sound-bachlauf/scheduler.js

/**
 * Scheduler für LED Sound Bachlauf
 * Führt periodische Updates von LEDs und Audio aus
 * Unterstützt Simulation, falls Hardware nicht vorhanden
 */

const config = require('./config');
const ledControll = require('./led-controll');
const audioScenario = require('./audio-scenario');

const simulate = config.simulation.enable;

class Scheduler {
  constructor() {
    this.interval = config.scenarios.updateInterval || 1000; // Standard 1 Sekunde
    this.timer = null;

    if (simulate) {
      console.log('[SIMULATION] Scheduler init aufgerufen');
    }

    this.init();
  }

  init() {
    try {
      // Prüfen ob ledControll verfügbar ist
      if (!ledControll || typeof ledControll.update !== 'function') {
        throw new Error('LED Controller nicht verfügbar');
      }

      this.timer = setInterval(() => this.run(), this.interval);

      console.log(`[SIMULATION] Scheduler gestartet mit Intervall ${this.interval} ms`);
    } catch (err) {
      if (simulate) {
        console.log(`[SIMULATION] Scheduler konnte nicht initialisiert werden, Simulation aktiv: ${err.message}`);
      } else {
        console.error('Scheduler-Fehler:', err);
      }
    }
  }

  run() {
    try {
      // Aktives Szenario abfragen
      const activeScenario = ledControll.getActiveScenario
        ? ledControll.getActiveScenario()
        : null;

      if (simulate) {
        console.log(`[SIMULATION] Scheduler läuft - Aktuelles Szenario: ${activeScenario || 'keins'}`);
      }

      // LEDs aktualisieren
      if (activeScenario && typeof ledControll.update === 'function') {
        ledControll.update(activeScenario);
      }

      // Audio abspielen
      if (audioScenario && typeof audioScenario.scheduleAudioPlayback === 'function') {
        audioScenario.scheduleAudioPlayback();
      }
    } catch (err) {
      if (simulate) {
        console.log(`[SIMULATION] Scheduler run Error: ${err.message}`);
      } else {
        console.error('Scheduler run Error:', err);
      }
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      if (simulate) {
        console.log('[SIMULATION] Scheduler gestoppt');
      }
    }
  }
}

// Singleton exportieren
module.exports = new Scheduler();
