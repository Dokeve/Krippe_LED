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
  // Use HSL interpolation to produce perceptually smoother color blends
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hexToRgb = (hex) => {
    const h = (hex || '#000000').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const val = parseInt(full, 16) >>> 0;
    return { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff };
  };
  const rgbToHex = ({ r, g, b }) => {
    const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  // convert RGB [0..255] to HSL {h:0-360, s:0-1, l:0-1}
  const rgbToHsl = ({ r, g, b }) => {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
        case gn: h = (bn - rn) / d + 2; break;
        case bn: h = (rn - gn) / d + 4; break;
      }
      h = h * 60;
    }
    return { h: clamp(h, 0, 360), s: clamp(s, 0, 1), l: clamp(l, 0, 1) };
  };

  // convert HSL back to RGB
  const hslToRgb = ({ h, s, l }) => {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const hn = ((h % 360) + 360) % 360 / 360;
    if (s === 0) {
      const v = l * 255;
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, hn + 1/3) * 255;
    const g = hue2rgb(p, q, hn) * 255;
    const b = hue2rgb(p, q, hn - 1/3) * 255;
    return { r, g, b };
  };

  const aRgb = hexToRgb(hexA || '#000000');
  const bRgb = hexToRgb(hexB || '#000000');
  const aHsl = rgbToHsl(aRgb);
  const bHsl = rgbToHsl(bRgb);

  const tt = clamp(Number(t) || 0, 0, 1);
  // interpolate hue on the shortest path
  const hueDiff = ((bHsl.h - aHsl.h + 540) % 360) - 180; // range [-180,180)
  const h = (aHsl.h + hueDiff * tt + 360) % 360;
  const s = aHsl.s + (bHsl.s - aHsl.s) * tt;
  const l = aHsl.l + (bHsl.l - aHsl.l) * tt;

  const outRgb = hslToRgb({ h, s, l });
  return rgbToHex(outRgb);
}

export { findScenario, totalCycleSeconds };

export default { getActiveScenarioAt, lerpColor, findScenario, totalCycleSeconds };

