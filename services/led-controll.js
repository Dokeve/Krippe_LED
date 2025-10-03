// services/led-controll.js
// Letzte Änderung: 03.10.2025 17:20 Uhr (ESM-Portierung)
import ws from './ws2812.js';
import * as db from './db.js';
import { getActiveScenarioAt, lerpColor, findScenario } from './scenario-controll.js';

let _mode = 'auto'; // 'on' | 'off' | 'auto'
let _tick = 0;

export function setMode(m) { _mode = m; }
export function getMode() { return _mode; }
export function setTick(t) { _tick = t; }
export function getTick() { return _tick; }

function withinWindow(sec, start, end) {
  if (isNaN(start) && isNaN(end)) return true;
  if (!isNaN(start) && isNaN(end)) return sec >= start;
  if (isNaN(start) && !isNaN(end)) return sec <= end;
  return sec >= start && sec <= end;
}

function selectedIndexes(text, count) {
  const set = new Set();
  (text || '').split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(n => parseInt(n, 10));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(count, Math.max(a, b)); i++) {
          set.add(i - 1);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= count) set.add(n - 1);
    }
  });
  return Array.from(set).sort((a, b) => a - b);
}

export async function applyModuleOn(colorHex = '#ffff00') {
  const count = ws.count ?? 0;
  if (count > 0) {
    ws.fillRange(0, count - 1, colorHex);
    ws.render();
  }
}

export async function applyModuleOff() {
  ws.clear?.();
}

function colorForIndex(baseColor, colorsArray, i) {
  if (Array.isArray(colorsArray) && colorsArray[i] && /^#[0-9a-fA-F]{6}$/.test(colorsArray[i])) {
    return colorsArray[i];
  }
  return baseColor;
}

export async function applyModuleAuto() {
  const ledCfg = await db.getLed();
  const active = getActiveScenarioAt(getTick());
  ws.clear?.();

  const groups = [];
  if (ledCfg.adventActive) groups.push(...(ledCfg.advent || []));
  if (ledCfg.weihnachtActive) groups.push(...(ledCfg.weihnacht || []));

  for (const sub of groups) {
    const from = Math.max(0, sub.ledFrom | 0);
    const to = Math.min((ws.count ?? 0) - 1, sub.ledTo | 0);
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
        for (let rel = 0; rel < count; rel++) {
          const abs = from + rel;
          if (abs >= from && abs <= to) {
            ws.setPixel?.(abs, colorForIndex(baseColor, perLed, rel));
          }
        }
      } else {
        ws.fillRange(from, to, baseColor);
      }
      continue;
    }

    let anyApplied = false;
    for (const sc of sub.scenarios) {
      if (!sc.name) continue;
      if (sc.name !== active.name) continue;
      const s = parseInt(sc.start);
      const e = parseInt(sc.end);
      if (!withinWindow(active.second, s, e)) continue;

      const sel = selectedIndexes(sc.leds || '', count);
      if (sel.length === 0) {
        if (perLed && perLed.length) {
          for (let rel = 0; rel < count; rel++) {
            const abs = from + rel;
            if (abs >= from && abs <= to) {
              ws.setPixel?.(abs, colorForIndex(baseColor, perLed, rel));
            }
          }
        } else {
          ws.fillRange(from, to, baseColor);
        }
        anyApplied = true;
      } else {
        for (const rel of sel) {
          const abs = from + rel;
          if (abs >= from && abs <= to) {
            ws.setPixel?.(abs, colorForIndex(baseColor, perLed, rel));
          }
        }
        anyApplied = true;
      }
    }

    if (!anyApplied) {
      // keine Regel griff ? nichts tun (bleibt aus)
    }
  }

  if (ledCfg.lagerfeuer && ledCfg.lagerfeuer.colors && ledCfg.lagerfeuer.scenarios) {
    const from = ledCfg.lagerfeuer.ledFrom | 0;
    const to = ledCfg.lagerfeuer.ledTo | 0;
    const cols = ledCfg.lagerfeuer.colors.filter(Boolean);
    for (const sc of ledCfg.lagerfeuer.scenarios) {
      if (sc.name !== active.name) continue;
      const s = parseInt(sc.start);
      const e = parseInt(sc.end);
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
