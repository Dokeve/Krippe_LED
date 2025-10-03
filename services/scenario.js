// services/scenario.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
export const SCENARIOS = [
  { name: 'Tag', duration: 100 },
  { name: 'Tag-Nacht', duration: 50 },
  { name: 'Nacht', duration: 100 },
  { name: 'Nacht-Tag', duration: 50 }
];

export function findScenario(name) {
  return SCENARIOS.find(s => s.name === name) || null;
}

export function totalCycleSeconds() {
  return SCENARIOS.reduce((sum, s) => sum + s.duration, 0); // 300
}

export default { SCENARIOS, findScenario, totalCycleSeconds };
