// services/scenario.js
// Letzte Änderung: 30.08.2025 19.15 Uhr
// Definitionen der Szenarien und Dauer (Sekunden)
const SCENARIOS = [
  { name: 'Tag', duration: 100 },
  { name: 'Tag-Nacht', duration: 50 },
  { name: 'Nacht', duration: 100 },
  { name: 'Nacht-Tag', duration: 50 }
];

function findScenario(name) {
  return SCENARIOS.find(s => s.name === name) || null;
}

function totalCycleSeconds() {
  return SCENARIOS.reduce((sum, s) => sum + s.duration, 0); // 300
}

module.exports = { SCENARIOS, findScenario, totalCycleSeconds };
