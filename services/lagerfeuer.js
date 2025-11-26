// services/lagerfeuer.js
// Extracted Lagerfeuer / fire flicker algorithm so it can be swapped or tested independently.
import { lerpColor } from './scenario-controll.js';

const LED_OFF = '#000000';

function sanitizeHex(hex, fallback = LED_OFF) {
  if (typeof hex !== 'string') return fallback;
  const value = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function hexToRgb(hex) {
  const h = (sanitizeHex(hex, LED_OFF) || '#000000').slice(1);
  const val = parseInt(h, 16) >>> 0;
  return { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function blendHex(a, b, alpha) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  const inv = 1 - alpha;
  return rgbToHex({ r: A.r * inv + B.r * alpha, g: A.g * inv + B.g * alpha, b: A.b * inv + B.b * alpha });
}

function pseudo(n) {
  const a = 9301, c = 49297, m = 233280;
  return ((n * a + c) % m) / m;
}

function valueNoise(seed, x) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const smooth = (u) => u * u * (3 - 2 * u);
  const a = pseudo(seed + xi);
  const b = pseudo(seed + xi + 1);
  return a + (b - a) * smooth(xf);
}

function dimHex(hex, factor) {
  const h = sanitizeHex(hex, LED_OFF).slice(1);
  const val = parseInt(h, 16) >>> 0;
  let r = (val >> 16) & 0xff;
  let g = (val >> 8) & 0xff;
  let b = val & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function correctGreenish(hex) {
  const rgb = hexToRgb(hex);
  if (rgb.g > rgb.r && rgb.g > rgb.b) {
    rgb.g = Math.round(rgb.g * 0.75);
    rgb.r = Math.min(255, Math.round(rgb.r + (Math.round((255 - rgb.r) * 0.12))));
  }
  return rgbToHex(rgb);
}

// --- simple implementation (überführt von lagerfeuer-simple.js) ---
function randInt(min, max) {
  const a = Math.floor(min) || 0;
  const b = Math.floor(max) || 0;
  if (b <= a) return a;
  return Math.floor(Math.random() * (b - a)) + a;
}

export function applyLagerfeuerSimple({ frame, lastFrame, ledCfg, scenarioInfo, getTick }) {
  if (!frame || !Array.isArray(frame)) return;

  let fire = null;
  if (ledCfg?.adventActive && ledCfg?.adventLagerfeuer) {
    fire = ledCfg.adventLagerfeuer;
  } else if (ledCfg?.weihnachtActive && ledCfg?.weihnachtLagerfeuer) {
    fire = ledCfg.weihnachtLagerfeuer;
  } else {
    fire = ledCfg?.lagerfeuer || null;
  }

  if (!fire) return;

  const frameLen = frame.length;
  const fromIdx = Math.max(0, fire.ledFrom | 0);
  const toIdx = Math.min(frameLen - 1, fire.ledTo | 0);
  const count = Math.max(0, toIdx - fromIdx + 1);
  if (count <= 0) return;

  const LightValue = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const r = randInt(0, 200);
    const g = randInt(0,20 );
    const b = randInt(0, 0);
    LightValue[i] = { r, g, b };
  }

  const lightsOff = randInt(0, 4);
  for (let k = 0; k < lightsOff; k += 1) {
    const sel = randInt(0, count);
    LightValue[sel] = { r: randInt(0, 200), g: randInt(64, 128), b: randInt(0, 0) };
  }

  for (let offset = 0; offset < count; offset += 1) {
    const absolute = fromIdx + offset;
    if (absolute < 0 || absolute >= frameLen) continue;
    const v = LightValue[offset];
    frame[absolute] = rgbToHex(v);
  }
}

// --- end simple implementation ------------------------------------------------

// applyLagerfeuer mutates `frame` in-place. It expects `frame` to be an array of hex colors
// `lastFrame` may be provided to smooth across frames. `ledCfg` is the full led configuration
// (used to select advent/weihnacht/legacy fire), `scenarioInfo` is the active scenario object
// and `getTick` is a function returning the current tick number.
export function applyLagerfeuer({ frame, lastFrame, ledCfg, scenarioInfo, getTick }) {
  if (!frame || !Array.isArray(frame)) return;
  // select the active group-specific lagerfeuer configuration
  let fire = null;
  if (ledCfg.adventActive && ledCfg.adventLagerfeuer) {
    fire = ledCfg.adventLagerfeuer;
  } else if (ledCfg.weihnachtActive && ledCfg.weihnachtLagerfeuer) {
    fire = ledCfg.weihnachtLagerfeuer;
  } else {
    fire = ledCfg.lagerfeuer || null;
  }

  // If the configuration requests the simple implementation, delegate to it.
  if (fire && fire.useSimple) {
    try {
      applyLagerfeuerSimple({ frame, lastFrame, ledCfg, scenarioInfo, getTick });
    } catch (e) {
      console.warn('[lagerfeuer] simple apply failed:', e?.message || e);
    }
    return;
  }

  if (!fire || !Array.isArray(fire.colors) || !Array.isArray(fire.scenarios)) return;

  const colors = fire.colors.filter((value) => /^#[0-9a-f]{6}$/i.test(value));
  if (colors.length === 0) return;

  const frameLen = frame.length;

  for (const scenario of fire.scenarios) {
    if (!scenario || scenario.name !== scenarioInfo.name) continue;
    const start = parseInt(scenario.start, 10);
    const end = parseInt(scenario.end, 10);
    const second = scenarioInfo.second;
    const withinWindow = (() => {
      const hasStart = Number.isFinite(start);
      const hasEnd = Number.isFinite(end);
      if (!hasStart && !hasEnd) return true;
      if (hasStart && !hasEnd) return second >= start;
      if (!hasStart && hasEnd) return second <= end;
      return second >= start && second <= end;
    })();
    if (!withinWindow) continue;

    const fromIdx = Math.max(0, fire.ledFrom | 0);
    const toIdx = Math.min(frameLen - 1, fire.ledTo | 0);
    const count = Math.max(0, toIdx - fromIdx + 1);
    if (count <= 0) continue;

    const baseTick = typeof getTick === 'function' ? getTick() : 0;
    const useValueNoise = !!(fire.useValueNoise);
    const speedMultiplier = Number.isFinite(Number(fire.speedMultiplier)) ? Number(fire.speedMultiplier) : 10;
    const smoothingAlpha = Number.isFinite(Number(fire.smoothingAlpha)) ? Number(fire.smoothingAlpha) : 0.6;
    const flickerIntensity = Number.isFinite(Number(fire.flickerIntensity)) ? Number(fire.flickerIntensity) : 1.0;
    const blackoutProb = Number.isFinite(Number(fire.blackoutProb)) ? Number(fire.blackoutProb) : 0.02;
    const colorScatter = Number.isFinite(Number(fire.colorScatter)) ? Number(fire.colorScatter) : 0.7;
    const lowFreq = 0.02;

    let perLedColors = null;
    if (fire.spreadColorsEvenly) {
      const bucket = [];
      const baseCount = Math.floor(count / colors.length) || 0;
      let remainder = count - baseCount * colors.length;
      for (let ci = 0; ci < colors.length; ci += 1) {
        for (let k = 0; k < baseCount; k += 1) bucket.push(colors[ci]);
        if (remainder > 0) { bucket.push(colors[ci]); remainder -= 1; }
      }
      const positions = Array.from({ length: count }, (_, i) => i).sort((a, b) => pseudo(a + baseTick * 13) - pseudo(b + baseTick * 13));
      perLedColors = new Array(count);
      for (let i = 0; i < count; i += 1) {
        perLedColors[positions[i]] = bucket[i % bucket.length] || colors[i % colors.length];
      }
    }

    for (let offset = 0; offset < count; offset += 1) {
      const absolute = fromIdx + offset;
      const rseed = pseudo(absolute + 1);
      const tSlow = baseTick * lowFreq * (0.6 + rseed * 0.8);
      const tFast = baseTick * 0.45 * speedMultiplier * (0.6 + rseed * 0.8);

      let n = 0;
      if (useValueNoise) {
        const n1 = valueNoise(absolute + 13, tFast * 0.05);
        const n2 = valueNoise(absolute + 19, tSlow * 0.12);
        n = (n1 * 0.7) + (n2 * 0.3);
      } else {
        n = pseudo(absolute * 37 + Math.floor(tFast));
      }

      const sway = 0.5 + 0.5 * Math.sin(tSlow + rseed * 6.2831);

      let brightness = clamp01(n * (0.5 + 0.5 * rseed) * sway * flickerIntensity);

      if (pseudo(baseTick + absolute * 17) < blackoutProb) {
        brightness = 0;
      }

      let baseColor = null;
      if (Array.isArray(perLedColors) && perLedColors[offset]) {
        baseColor = sanitizeHex(perLedColors[offset]);
      } else {
        const palettePos = (tFast * 0.02 + (offset * colorScatter * (0.2 + rseed * 0.8))) % colors.length;
        const idx = Math.floor(palettePos) % colors.length;
        const next = (idx + 1) % colors.length;
        const tt = palettePos - Math.floor(palettePos);
        baseColor = lerpColor(colors[idx], colors[next], tt);
      }

      const colorShift = pseudo(absolute + 77);
      if (colorShift > 0.65) {
        baseColor = lerpColor(baseColor, '#FF4500', (colorShift - 0.65) * 2.857);
      } else if (colorShift < 0.15) {
        baseColor = lerpColor(baseColor, '#FFD700', (0.15 - colorShift) * 6.666);
      }

      baseColor = correctGreenish(baseColor);

      const brightnessFactor = Math.max(0.2, Math.min(1.4, 0.2 + brightness * 1.5));
      const computed = dimHex(baseColor, brightnessFactor);

      if (lastFrame && Array.isArray(lastFrame) && lastFrame[absolute]) {
        frame[absolute] = blendHex(lastFrame[absolute], computed, smoothingAlpha);
      } else {
        frame[absolute] = computed;
      }
    }
  }
}

export default {
  applyLagerfeuer
};
