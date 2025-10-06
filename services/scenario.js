// services/scenario.js
// Definiert die Szenarien (Tag/Nacht) basierend auf den konfigurierten Zykluszeiten.
import config from '../config.js';

const cycleSeconds = config.scheduler?.cycleSeconds ?? {};
const getDuration = (key, fallback) => {
  const value = Number(cycleSeconds[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

export const SCENARIOS = [
  { name: 'Tag',       duration: getDuration('day', 100) },
  { name: 'Tag-Nacht', duration: getDuration('dayNight', 50) },
  { name: 'Nacht',     duration: getDuration('night', 100) },
  { name: 'Nacht-Tag', duration: getDuration('nightDay', 50) }
];

export function findScenario(name) {
  return SCENARIOS.find((scenario) => scenario.name === name) || null;
}

export function totalCycleSeconds() {
  return SCENARIOS.reduce((sum, scenario) => sum + scenario.duration, 0);
}

export default { SCENARIOS, findScenario, totalCycleSeconds };
