// services/led-controll.js
// Steuert den LED-Modus (An/Aus/Automatisch) anhand der Konfiguration und Szenarien.
import ws from './ws2812.js';
import { getLedConfig } from './led-store.js';
import { getActiveScenarioAt, lerpColor } from './scenario-controll.js';
import config from '../config.js';

let currentMode = 'auto';
let currentTick = 0;

export function setMode(mode) {
  currentMode = typeof mode === 'string' ? mode : 'auto';
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

async function ensureInitialized() {
  await ws.initLEDs(config.led.count);
}

function withinWindow(second, start, end) {
  if (Number.isNaN(start) && Number.isNaN(end)) return true;
  if (!Number.isNaN(start) && Number.isNaN(end)) return second >= start;
  if (Number.isNaN(start) && !Number.isNaN(end)) return second <= end;
  return second >= start && second <= end;
}

function selectedIndexes(text, count) {
  const set = new Set();
  (text || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map((n) => parseInt(n, 10));
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(count, Math.max(a, b)); i += 1) {
            set.add(i - 1);
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

export async function applyModuleOn(colorHex = '#ffff00') {
  await ensureInitialized();
  const count = ws.count ?? 0;
  if (count > 0) {
    ws.fillRange(0, count - 1, colorHex);
    ws.render();
  }
}

export async function applyModuleOff() {
  ws.clear?.();
}

function colorForIndex(baseColor, colorsArray, index) {
  if (Array.isArray(colorsArray) && colorsArray[index] && /^#[0-9a-fA-F]{6}$/.test(colorsArray[index])) {
    return colorsArray[index];
  }
  return baseColor;
}

export async function applyModuleAuto() {
  await ensureInitialized();
  const ledCfg = getLedConfig();
  const scenarioInfo = getActiveScenarioAt(getTick());
  ws.clear?.();

  const groups = [];
  if (ledCfg.adventActive) groups.push(...(ledCfg.advent || []));
  if (ledCfg.weihnachtActive) groups.push(...(ledCfg.weihnacht || []));

  const ledCount = ws.count ?? 0;

  for (const group of groups) {
    const from = Math.max(0, group.ledFrom | 0);
    const to = Math.min(Math.max(0, ledCount - 1), group.ledTo | 0);
    const count = Math.max(0, group.ledCount | 0);
    const colorDay = group.colorDay || '#000000';
    const colorNight = group.colorNight || '#000000';
    const perLed = Array.isArray(group.colors) ? group.colors : null;

    let baseColor = colorDay;
    if (scenarioInfo.name === 'Nacht') baseColor = colorNight;
    if (group.wall) {
      if (scenarioInfo.name === 'Tag-Nacht') {
        const t = scenarioInfo.second / scenarioInfo.duration;
        baseColor = lerpColor(colorDay, colorNight, t);
      } else if (scenarioInfo.name === 'Nacht-Tag') {
        const t = scenarioInfo.second / scenarioInfo.duration;
        baseColor = lerpColor(colorNight, colorDay, t);
      }
    }

    if (!Array.isArray(group.scenarios) || group.scenarios.length === 0) {
      if (perLed && perLed.length) {
        for (let rel = 0; rel < count; rel += 1) {
          const absolute = from + rel;
          if (absolute >= from && absolute <= to) {
            ws.setPixel?.(absolute, colorForIndex(baseColor, perLed, rel));
          }
        }
      } else {
        ws.fillRange(from, to, baseColor);
      }
      continue;
    }

    let anyApplied = false;
    for (const scenario of group.scenarios) {
      if (!scenario.name || scenario.name !== scenarioInfo.name) continue;
      const start = parseInt(scenario.start, 10);
      const end = parseInt(scenario.end, 10);
      if (!withinWindow(scenarioInfo.second, start, end)) continue;

      const selection = selectedIndexes(scenario.leds || '', count);
      if (selection.length === 0) {
        if (perLed && perLed.length) {
          for (let rel = 0; rel < count; rel += 1) {
            const absolute = from + rel;
            if (absolute >= from && absolute <= to) {
              ws.setPixel?.(absolute, colorForIndex(baseColor, perLed, rel));
            }
          }
        } else {
          ws.fillRange(from, to, baseColor);
        }
        anyApplied = true;
      } else {
        for (const rel of selection) {
          const absolute = from + rel;
          if (absolute >= from && absolute <= to) {
            ws.setPixel?.(absolute, colorForIndex(baseColor, perLed, rel));
          }
        }
        anyApplied = true;
      }
    }

    if (!anyApplied) {
      // Keine Regel aktiv – LEDs bleiben aus.
    }
  }

  if (ledCfg.lagerfeuer && ledCfg.lagerfeuer.colors && ledCfg.lagerfeuer.scenarios) {
    const from = ledCfg.lagerfeuer.ledFrom | 0;
    const to = ledCfg.lagerfeuer.ledTo | 0;
    const colors = ledCfg.lagerfeuer.colors.filter(Boolean);
    for (const scenario of ledCfg.lagerfeuer.scenarios) {
      if (scenario.name !== scenarioInfo.name) continue;
      const start = parseInt(scenario.start, 10);
      const end = parseInt(scenario.end, 10);
      if (!withinWindow(scenarioInfo.second, start, end)) continue;
      if (colors.length) {
        const phase = Math.floor((getTick() % colors.length));
        ws.fillRange(from, to, colors[phase]);
      }
    }
  }

  ws.render?.();
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
