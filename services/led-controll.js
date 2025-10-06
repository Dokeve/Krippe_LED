// services/led-controll.js
// Steuert LED-Modus (an/aus/auto) auf Basis von Ladenkonfiguration und Szenarien.
// Die Funktion stellt sicher, dass der WS2812-Treiber initialisiert ist, bevor Pixel beschrieben werden.
import ws from './ws2812.js';
import { getLedConfig } from './led-store.js';
import { getActiveScenarioAt, lerpColor } from './scenario-controll.js';
import config from '../config.js';

let _mode = 'auto'; // gültige Werte: 'on' | 'off' | 'auto'
let _tick = 0;      // aktuelle Sekunde im Zyklus für Modul "auto"

export function setMode(mode) {
  _mode = typeof mode === 'string' ? mode : 'auto';
}

export function getMode() {
  return _mode;
}

export function setTick(tick) {
  _tick = Number.isFinite(tick) ? tick : 0;
}

export function getTick() {
  return _tick;
}

async function ensureInitialized() {
  const targetCount = config.led?.count ?? 200;
  if ((ws.count ?? 0) !== targetCount) {
    await ws.initLEDs(targetCount);
  }
}

function withinWindow(sec, start, end) {
  if (Number.isNaN(start) && Number.isNaN(end)) return true;
  if (!Number.isNaN(start) && Number.isNaN(end)) return sec >= start;
  if (Number.isNaN(start) && !Number.isNaN(end)) return sec <= end;
  return sec >= start && sec <= end;
}

function selectedIndexes(text, count) {
  const set = new Set();
  (text || '')
    .split(',')
    .map((s) => s.trim())
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
        const n = parseInt(part, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= count) set.add(n - 1);
      }
    });
  return Array.from(set).sort((a, b) => a - b);
}

export async function applyModuleOn(colorHex = '#ff0000ff') {
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
  const active = getActiveScenarioAt(getTick());
  ws.clear?.();

  const groups = [];
  if (ledCfg.adventActive) groups.push(...(ledCfg.advent || []));
  if (ledCfg.weihnachtActive) groups.push(...(ledCfg.weihnacht || []));

  const ledCount = ws.count ?? 0;

  for (const sub of groups) {
    const from = Math.max(0, sub.ledFrom | 0);
    const to = Math.min(Math.max(0, ledCount - 1), sub.ledTo | 0);
    const count = Math.max(0, sub.ledCount | 0);
    const colorDay = sub.colorDay || '#000000';
    const colorNight = sub.colorNight || '#000000';
    const perLed = Array.isArray(sub.colors) ? sub.colors : null;

    let baseColor = colorDay;
    if (active.name === 'Nacht') baseColor = colorNight;
    if (sub.wall) {
      if (active.name === 'Tag-Nacht') {
        const t = active.second / active.duration;
        baseColor = lerpColor(colorDay, colorNight, t);
      } else if (active.name === 'Nacht-Tag') {
        const t = active.second / active.duration;
        baseColor = lerpColor(colorNight, colorDay, t);
      }
    }

    if (!Array.isArray(sub.scenarios) || sub.scenarios.length === 0) {
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
    for (const sc of sub.scenarios) {
      if (!sc.name || sc.name !== active.name) continue;
      const s = parseInt(sc.start, 10);
      const e = parseInt(sc.end, 10);
      if (!withinWindow(active.second, s, e)) continue;

      const sel = selectedIndexes(sc.leds || '', count);
      if (sel.length === 0) {
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
        for (const rel of sel) {
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
    const cols = ledCfg.lagerfeuer.colors.filter(Boolean);
    for (const sc of ledCfg.lagerfeuer.scenarios) {
      if (sc.name !== active.name) continue;
      const s = parseInt(sc.start, 10);
      const e = parseInt(sc.end, 10);
      if (!withinWindow(active.second, s, e)) continue;
      if (cols.length) {
        const phase = Math.floor((getTick() % cols.length));
        ws.fillRange(from, to, cols[phase]);
      }
    }
  }

  ws.render?.();
}

export async function apply() {
  if (_mode === 'off') return applyModuleOff();
  if (_mode === 'on') return applyModuleOn();
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
