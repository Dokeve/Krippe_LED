// services/scenario-controll.js
// Hilfsfunktionen für Szenarien (aktuelle Phase, Farbüberblendung etc.).
import { SCENARIOS, findScenario, totalCycleSeconds } from './scenario.js';

export function getActiveScenarioAt(secondInCycle) {
  const cycle = totalCycleSeconds();
  if (cycle <= 0) {
    return { name: 'Tag', second: 0, duration: SCENARIOS[0]?.duration ?? 0 };
  }
  const mod = ((secondInCycle % cycle) + cycle) % cycle;
  let acc = 0;
  for (const scenario of SCENARIOS) {
    if (mod >= acc && mod < acc + scenario.duration) {
      return { name: scenario.name, second: mod - acc, duration: scenario.duration };
    }
    acc += scenario.duration;
  }
  const fallbackDuration = SCENARIOS[0]?.duration ?? 0;
  return { name: 'Tag', second: 0, duration: fallbackDuration };
}

export function lerpColor(hexA, hexB, t) {
  const parseChannel = (hex) => parseInt(hex, 16);
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = parseChannel(a.slice(0, 2));
  const ag = parseChannel(a.slice(2, 4));
  const ab = parseChannel(a.slice(4, 6));
  const br = parseChannel(b.slice(0, 2));
  const bg = parseChannel(b.slice(2, 4));
  const bb = parseChannel(b.slice(4, 6));
  const rr = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
  const rg = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
  const rb = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
  return `#${rr}${rg}${rb}`;
}

export { findScenario, totalCycleSeconds };

export default { getActiveScenarioAt, lerpColor, findScenario, totalCycleSeconds };

