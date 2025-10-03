// services/scenario-controll.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import { SCENARIOS, findScenario, totalCycleSeconds } from './scenario.js';

// Ermittelt, welches Szenario (Tag / Tag-Nacht / Nacht / Nacht-Tag) aktiv ist und die verstrichene Sekunde in diesem Szenario.
export function getActiveScenarioAt(secondInCycle) {
  const cycle = totalCycleSeconds(); // 300
  const mod = ((secondInCycle % cycle) + cycle) % cycle;
  let acc = 0;
  for (const s of SCENARIOS) {
    if (mod >= acc && mod < acc + s.duration) {
      return { name: s.name, second: mod - acc, duration: s.duration };
    }
    acc += s.duration;
  }
  // fallback
  return { name: 'Tag', second: 0, duration: 100 };
}

// Hilfsfunktion für Sonnenauf-/untergang (Farben Überblenden)
export function lerpColor(hexA, hexB, t) {
  const toInt = (h) => parseInt(h, 16);
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = toInt(a.slice(0, 2));
  const ag = toInt(a.slice(2, 4));
  const ab = toInt(a.slice(4, 6));
  const br = toInt(b.slice(0, 2));
  const bg = toInt(b.slice(2, 4));
  const bb = toInt(b.slice(4, 6));
  const rr = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0');
  const rg = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0');
  const rb = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0');
  return `#${rr}${rg}${rb}`;
}

export { findScenario };

export default { getActiveScenarioAt, lerpColor, findScenario };
