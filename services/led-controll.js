// services/led-controll.js
// Steuert den LED-Modus (An/Aus/Automatisch) anhand der Konfiguration und Szenarien.
import ws from './ws2812.js';
import { getLedConfig } from './led-store.js';
import { getActiveScenarioAt, lerpColor } from './scenario-controll.js';
import config from '../config.js';

const LED_OFF = '#000000';

let currentMode = 'auto';
let currentTick = 0;
let lastFrame = null;

export function setMode(mode) {
  const normalized = typeof mode === 'string' ? mode.toLowerCase() : 'auto';
  const next = normalized === 'on' || normalized === 'off' || normalized === 'auto' ? normalized : 'auto';
  if (next !== currentMode) {
    currentMode = next;
    invalidateCache();
  }
}

export function getMode() {
  return currentMode;
}

export function setTick(tick) {
  currentTick = Number.isFinite(tick) ? tick : 0;
}

export function getTick() {
  return currentTick;
}

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

function paletteColor(palette, progress, fromColor, toColor) {
  const start = sanitizeHex(fromColor, LED_OFF);
  const end = sanitizeHex(toColor, start);
  const colors = Array.isArray(palette) ? palette.filter((hex) => /^#[0-9a-fA-F]{6}$/.test(hex)) : [];
  if (colors.length < 2) {
    return lerpColor(start, end, clamp01(progress));
  }
  const clamped = clamp01(progress);
  const steps = colors.length - 1;
  const scaled = clamped * steps;
  const index = Math.min(steps - 1, Math.floor(scaled));
  const localT = clamp01(scaled - index);
  const segmentStart = sanitizeHex(colors[index], start);
  const segmentEnd = sanitizeHex(colors[index + 1] || segmentStart, segmentStart);
  return lerpColor(segmentStart, segmentEnd, localT);
}

// color helpers for smoothing
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

function invalidateCache() {
  lastFrame = null;
}

async function getLedCount() {
  await ws.initLEDs(config.led.count);
  return ws.count ?? config.led.count ?? 0;
}

function ensureFrameSize(frame, count) {
  const base = Array.isArray(frame) ? frame.slice(0, count) : [];
  while (base.length < count) base.push(LED_OFF);
  return base;
}

function framesEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function renderFrame(frameInput) {
  const ledCount = await getLedCount();
  const frame = ensureFrameSize(frameInput, ledCount).map((color) => sanitizeHex(color, LED_OFF));

  if (framesEqual(lastFrame, frame)) {
    return;
  }

  let start = 0;
  while (start < frame.length) {
    const color = frame[start];
    let end = start;
    while (end + 1 < frame.length && frame[end + 1] === color) {
      end += 1;
    }

    if (typeof ws.fillRange === 'function') {
      ws.fillRange(start, end, color);
    } else {
      for (let index = start; index <= end; index += 1) {
        ws.setPixel?.(index, color);
      }
    }

    start = end + 1;
  }

  ws.render?.();
  lastFrame = frame.slice();
}

function withinWindow(second, start, end) {
  const hasStart = Number.isFinite(start);
  const hasEnd = Number.isFinite(end);
  if (!hasStart && !hasEnd) return true;
  if (hasStart && !hasEnd) return second >= start;
  if (!hasStart && hasEnd) return second <= end;
  return second >= start && second <= end;
}

function selectedIndexes(input, count) {
  const raw = Array.isArray(input) ? input.join(',') : (input || '');
  const set = new Set();
  raw.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(part => {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map((n) => parseInt(n, 10));
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          const start = Math.max(1, Math.min(a, b));
          const end = Math.min(count, Math.max(a, b));
          for (let value = start; value <= end; value += 1) {
            set.add(value - 1);
          }
        }
      } else {
        const index = parseInt(part, 10);
        if (!Number.isNaN(index) && index >= 1 && index <= count) {
          set.add(index - 1);
        }
      }
    });
  return Array.from(set).sort((a, b) => a - b);
}

function colorForIndex(baseColor, perLed, index) {
  if (Array.isArray(perLed) && perLed[index] && /^#[0-9a-fA-F]{6}$/.test(perLed[index])) {
    return sanitizeHex(perLed[index], baseColor);
  }
  return sanitizeHex(baseColor);
}

function applyRangeToFrame(frame, from, to, baseColor, perLed) {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(frame.length - 1, Math.max(from, to));
  if (start > end) return;

  if (Array.isArray(perLed) && perLed.length > 0) {
    for (let offset = 0; offset <= end - start; offset += 1) {
      const absolute = start + offset;
      frame[absolute] = colorForIndex(baseColor, perLed, offset);
    }
    return;
  }

  const color = sanitizeHex(baseColor, LED_OFF);
  for (let index = start; index <= end; index += 1) {
    frame[index] = color;
  }
}

export async function applyModuleOn(colorHex = '#FFD700') {
  const count = await getLedCount();
  const color = sanitizeHex(colorHex, '#FFD700');
  await renderFrame(new Array(count).fill(color));
}

export async function applyModuleOff() {
  const count = await getLedCount();
  await renderFrame(new Array(count).fill(LED_OFF));
}

export async function applyModuleAuto() {
  const ledCount = await getLedCount();
  if (ledCount <= 0) {
    ws.clear?.();
    lastFrame = [];
    return;
  }

  const ledCfg = getLedConfig();
  const scenarioInfo = getActiveScenarioAt(getTick());
  const frame = new Array(ledCount).fill(LED_OFF);
  const transitions = ledCfg.transitions || {};
  const dayNightPalette = Array.isArray(transitions.dayNight) ? transitions.dayNight : [];
  const nightDayPalette = Array.isArray(transitions.nightDay) ? transitions.nightDay : [];

  const groups = [];
  if (ledCfg.adventActive) groups.push(...(ledCfg.advent || []));
  if (ledCfg.weihnachtActive) groups.push(...(ledCfg.weihnacht || []));

  for (const group of groups) {
    const from = Math.max(0, group.ledFrom | 0);
    const to = Math.min(ledCount - 1, group.ledTo | 0);
    const count = Math.max(0, group.ledCount | 0);
    if (from > to || count <= 0) continue;

    const perLed = Array.isArray(group.colors) ? group.colors : null;
    const dayColor = sanitizeHex(group.colorDay || LED_OFF, LED_OFF);
    const nightColor = sanitizeHex(group.colorNight || LED_OFF, LED_OFF);
    let baseColor = dayColor;

    if (group.alwaysOn) {
      applyRangeToFrame(frame, from, to, dayColor, null);
      continue;
    }

    if (scenarioInfo.name === 'Nacht') {
      baseColor = nightColor;
    } else if (group.wall && scenarioInfo.name === 'Tag-Nacht') {
      const mix = scenarioInfo.duration > 0 ? scenarioInfo.second / scenarioInfo.duration : 0;
      baseColor = paletteColor(dayNightPalette, mix, dayColor, nightColor);
    } else if (group.wall && scenarioInfo.name === 'Nacht-Tag') {
      const mix = scenarioInfo.duration > 0 ? scenarioInfo.second / scenarioInfo.duration : 0;
      baseColor = paletteColor(nightDayPalette, mix, nightColor, dayColor);
    }

    if (!Array.isArray(group.scenarios) || group.scenarios.length === 0) {
      applyRangeToFrame(frame, from, to, baseColor, perLed);
      continue;
    }

    let applied = false;
    for (const scenario of group.scenarios) {
      if (!scenario || scenario.name !== scenarioInfo.name) continue;
      const start = parseInt(scenario.start, 10);
      const end = parseInt(scenario.end, 10);
      if (!withinWindow(scenarioInfo.second, start, end)) continue;

      const selected = selectedIndexes(scenario.leds || '', count);
      if (selected.length === 0) {
        applyRangeToFrame(frame, from, to, baseColor, perLed);
      } else {
        for (const rel of selected) {
          const absolute = from + rel;
          if (absolute >= from && absolute <= to && absolute < frame.length) {
            frame[absolute] = colorForIndex(baseColor, perLed, rel);
          }
        }
      }

      applied = true;
    }

    if (!applied) {
      // Keine Regel aktiv -> Segment bleibt dunkel.
    }
  }

  // select the active group-specific lagerfeuer configuration
  // prefer advent when active, then weihnacht, fallback to legacy top-level lagerfeuer
  let fire = null;
  if (ledCfg.adventActive && ledCfg.adventLagerfeuer) {
    fire = ledCfg.adventLagerfeuer;
  } else if (ledCfg.weihnachtActive && ledCfg.weihnachtLagerfeuer) {
    fire = ledCfg.weihnachtLagerfeuer;
  } else {
    fire = ledCfg.lagerfeuer || null;
  }
  if (fire && Array.isArray(fire.colors) && Array.isArray(fire.scenarios)) {
    const colors = fire.colors.filter((value) => /^#[0-9a-f]{6}$/i.test(value));
    if (colors.length > 0) {
      // helpers: deterministic pseudo-random in [0,1) per index
      const pseudo = (n) => {
        const a = 9301, c = 49297, m = 233280;
        return ((n * a + c) % m) / m;
      };
      // Optional: lightweight value-noise function (fast) that can be used instead of pseudo() for smoother
      // spatial variation. Perlin noise is more natural but heavier; value-noise with smoothstep is cheap
      // and often good enough for visual flicker. Example usage: val = valueNoise(absolute, t)
      const valueNoise = (seed, x) => {
        const xi = Math.floor(x);
        const xf = x - xi;
        const smooth = (u) => u * u * (3 - 2 * u);
        const a = pseudo(seed + xi);
        const b = pseudo(seed + xi + 1);
        return a + (b - a) * smooth(xf);
      };
      const dimHex = (hex, factor) => {
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
      };

      for (const scenario of fire.scenarios) {
        if (!scenario || scenario.name !== scenarioInfo.name) continue;
        const start = parseInt(scenario.start, 10);
        const end = parseInt(scenario.end, 10);
        if (!withinWindow(scenarioInfo.second, start, end)) continue;

        const fromIdx = Math.max(0, fire.ledFrom | 0);
        const toIdx = Math.min(frame.length - 1, fire.ledTo | 0);
        const count = Math.max(0, toIdx - fromIdx + 1);
        if (count <= 0) continue;

  // Per-LED flicker: each LED has a deterministic speed offset and phase
  const baseTick = getTick();
  // read optional per-fire configuration (use valueNoise?, speed multiplier)
  const useValueNoise = !!(fire.useValueNoise);
  const speedMultiplier = Number.isFinite(Number(fire.speedMultiplier)) ? Number(fire.speedMultiplier) : 10; // default 10x
        const smoothingAlpha = Number.isFinite(Number(fire.smoothingAlpha)) ? Number(fire.smoothingAlpha) : 0.6;
        // Improved flicker: make per-LED brightness, on/off, and color vary more chaotically
        // Parameters available in `fire` (optional): useValueNoise, speedMultiplier, smoothingAlpha,
        // flickerIntensity (0..2), blackoutProb (0..1), colorScatter (0..2)
        const flickerIntensity = Number.isFinite(Number(fire.flickerIntensity)) ? Number(fire.flickerIntensity) : 1.0;
        const blackoutProb = Number.isFinite(Number(fire.blackoutProb)) ? Number(fire.blackoutProb) : 0.02;
        const colorScatter = Number.isFinite(Number(fire.colorScatter)) ? Number(fire.colorScatter) : 0.7;
        const lowFreq = 0.02; // gentle slow sway
        // optionally precompute an even color distribution per LED
        let perLedColors = null;
        if (fire.spreadColorsEvenly) {
          // build bucket with nearly-equal counts per color
          const bucket = [];
          const baseCount = Math.floor(count / colors.length) || 0;
          let remainder = count - baseCount * colors.length;
          for (let ci = 0; ci < colors.length; ci += 1) {
            for (let k = 0; k < baseCount; k += 1) bucket.push(colors[ci]);
            if (remainder > 0) { bucket.push(colors[ci]); remainder -= 1; }
          }
          // deterministic shuffle of positions to spread colors across the segment
          const positions = Array.from({ length: count }, (_, i) => i).sort((a, b) => pseudo(a + baseTick * 13) - pseudo(b + baseTick * 13));
          perLedColors = new Array(count);
          for (let i = 0; i < count; i += 1) {
            perLedColors[positions[i]] = bucket[i % bucket.length] || colors[i % colors.length];
          }
        }

        function correctGreenish(hex) {
          const rgb = hexToRgb(hex);
          // if green dominates strongly, reduce it slightly and boost red to avoid greenish yellows
          if (rgb.g > rgb.r && rgb.g > rgb.b) {
            rgb.g = Math.round(rgb.g * 0.75);
            rgb.r = Math.min(255, Math.round(rgb.r + (Math.round((255 - rgb.r) * 0.12))));
          }
          return rgbToHex(rgb);
        }

        for (let offset = 0; offset < count; offset += 1) {
          const absolute = fromIdx + offset;
          const rseed = pseudo(absolute + 1);

          // time bases
          const tSlow = getTick() * lowFreq * (0.6 + rseed * 0.8);
          const tFast = getTick() * 0.45 * speedMultiplier * (0.6 + rseed * 0.8);

          // noise-driven brightness [0..1]
          let n = 0;
          if (useValueNoise) {
            // combine two noise octaves for richer structure
            const n1 = valueNoise(absolute + 13, tFast * 0.05);
            const n2 = valueNoise(absolute + 19, tSlow * 0.12);
            n = (n1 * 0.7) + (n2 * 0.3);
          } else {
            n = pseudo(absolute * 37 + Math.floor(tFast));
          }

          // add a slow sinusoidal sway to avoid completely deterministic pattern
          const sway = 0.5 + 0.5 * Math.sin(tSlow + rseed * 6.2831);

          // final brightness with per-LED random variation and flickerIntensity
          let brightness = clamp01(n * (0.5 + 0.5 * rseed) * sway * flickerIntensity);

          // occasional brief blackout or spark
          if (pseudo(getTick() + absolute * 17) < blackoutProb) {
            // short blackout
            brightness = 0;
          }

          // choose color: either precomputed per-LED distribution or palette interpolation with scatter
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

          // occasional quick color shift to create warm/cool flickers
          const colorShift = pseudo(absolute + 77);
          if (colorShift > 0.65) {
            baseColor = lerpColor(baseColor, '#FF4500', (colorShift - 0.65) * 2.857); // up to ~1
          } else if (colorShift < 0.15) {
            baseColor = lerpColor(baseColor, '#FFD700', (0.15 - colorShift) * 6.666);
          }

          // correct any strong green bias that can make yellow look green
          baseColor = correctGreenish(baseColor);

          // brightness -> dim factor roughly in 0.2..1.4 range for lively flames
          const brightnessFactor = Math.max(0.2, Math.min(1.4, 0.2 + brightness * 1.5));
          const computed = dimHex(baseColor, brightnessFactor);

          // blend with previous frame for smoothing
          if (lastFrame && Array.isArray(lastFrame) && lastFrame[absolute]) {
            frame[absolute] = blendHex(lastFrame[absolute], computed, smoothingAlpha);
          } else {
            frame[absolute] = computed;
          }
        }
      }
    }
  }

  await renderFrame(frame);
}

export async function apply() {
  if (currentMode === 'off') return applyModuleOff();
  if (currentMode === 'on') return applyModuleOn();
  return applyModuleAuto();
}

export default {
  setMode,
  getMode,
  setTick,
  getTick,
  apply,
  applyModuleOn,
  applyModuleOff,
  applyModuleAuto
};
