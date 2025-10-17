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

  const fire = ledCfg.lagerfeuer;
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
        for (let offset = 0; offset < count; offset += 1) {
          const absolute = fromIdx + offset;
          const rseed = pseudo(absolute + 1);
          // speed varies between 0.4 .. 2.2 for more variety, scaled by multiplier
          const speed = (0.4 + rseed * 1.8) * speedMultiplier;
          // position along the color palette (fractional index)
          // if value-noise is enabled, use valueNoise for smoother temporal variation
          let temporal = baseTick * 0.45 * speed;
          if (useValueNoise) {
            // valueNoise(seed, x) returns [0..1) — scale it to palette length and combine with temporal
            const vn = valueNoise(absolute + 13, baseTick * 0.05 * speed);
            temporal = (vn * colors.length) + (baseTick * 0.02 * speed);
          }
          const pos = (temporal + rseed * colors.length) % colors.length;
          const idx = Math.floor(pos) % colors.length;
          const next = (idx + 1) % colors.length;
          const t = pos - Math.floor(pos);
          // blend neighbor colors (uses HSL-aware lerpColor)
          let baseColor = lerpColor(colors[idx], colors[next], t);

          // small hue/saturation jitter to avoid banding (blend slightly towards a warmer orange)
          const jitter = (pseudo(absolute + 51) - 0.5) * 0.25; // -0.125 .. +0.125
          if (Math.abs(jitter) > 0.001) {
            // warmColor chosen to bias towards an orange/gold
            const warmColor = '#FFB347';
            baseColor = lerpColor(baseColor, warmColor, Math.abs(jitter));
          }

          // stronger brightness modulation to simulate lively flames (range approx 0.55..1.4)
          const sinPart = Math.sin((baseTick * 0.5 + rseed * 10) * speed);
          const bright = 0.55 + (pseudo(absolute + 97) * 0.5) + sinPart * 0.15;
          const computed = dimHex(baseColor, Math.max(0.35, Math.min(1.4, bright)));
          // blend with previous frame to reduce blockiness
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
