// services/scenario-controll.js
// Letzte Änderung: 30.08.2025 19.15 Uhr
const { SCENARIOS, findScenario, totalCycleSeconds } = require('./scenario');

// Ermittelt, welches Szenario (Tag / Tag-Nacht / Nacht / Nacht-Tag) aktiv ist und die verstrichene Sekunde in diesem Szenario.
function getActiveScenarioAt(secondInCycle) {
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

// Hilfsfunktion für Sonnenauf-/untergang (Farben überblenden)
function lerpColor(hexA, hexB, t) {
  const c = (h)=>parseInt(h,16);
  const a = hexA.replace('#',''); const b = hexB.replace('#','');
  const ar=c(a.slice(0,2)), ag=c(a.slice(2,4)), ab=c(a.slice(4,6));
  const br=c(b.slice(0,2)), bg=c(b.slice(2,4)), bb=c(b.slice(4,6));
  const rr = Math.round(ar + (br-ar)*t).toString(16).padStart(2,'0');
  const rg = Math.round(ag + (bg-ag)*t).toString(16).padStart(2,'0');
  const rb = Math.round(ab + (bb-ab)*t).toString(16).padStart(2,'0');
  return `#${rr}${rg}${rb}`;
}

module.exports = { getActiveScenarioAt, lerpColor, findScenario };
