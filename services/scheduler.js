// services/scheduler.js
// Zentraler Scheduler – nutzt File-Stores (Kalender/LED/Audio)
import config from '../config.js';
import { getCalendarEvents } from './calendar-store.js';
import * as ledControll from './led-controll.js';
import ws2812 from './ws2812.js';
import audioScenario from './audio-scenario.js';

const POLL_INTERVAL_MS = 5000;
const TOTAL_CYCLE = Number(config.scheduler?.cycleSeconds?.total ?? 300) || 300;
let timer = null;
let lastModule = null; // '1' | '2' | null

async function ensureLedsInitialized() {
  try {
    await ws2812.initLEDs?.(config.led?.count ?? 200);
  } catch (e) {
    console.warn('[scheduler] LED-Init fehlgeschlagen:', e?.message || e);
  }
}

function findActiveEvent(now) {
  const events = getCalendarEvents();
  let active = null;
  for (const ev of events) {
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : start;
    if (Number.isNaN(start.getTime())) continue;
    if (start <= now && now <= end) {
      if (!active || new Date(active.start) < start) {
        active = ev;
      }
    }
  }
  return active;
}

function resolveModule(ev) {
  if (!ev) return null;
  const module = ev.module || ev.moduleId;
  if (module === '1' || module === '2') return module;
  const title = String(ev.title || '').toLowerCase();
  if (title.includes('modul 2')) return '2';
  if (title.includes('modul 1')) return '1';
  return null;
}

function computeSecondInCycle(event, now) {
  if (!event) return 0;
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = Math.max(0, Math.floor((now - start) / 1000));
  if (TOTAL_CYCLE <= 0) return diff;
  return diff % TOTAL_CYCLE;
}

async function applyModuleNone() {
  if (lastModule === null) return;
  ledControll.setMode('off');
  await ledControll.applyModuleOff();
  audioScenario.stopBackground();
  lastModule = null;
}

async function applyModule1() {
  if (lastModule !== '1') {
    await ensureLedsInitialized();
    ledControll.setMode('on');
    await ledControll.apply();
    audioScenario.stopBackground();
    lastModule = '1';
  }
}

async function applyModule2(secondInCycle) {
  await ensureLedsInitialized();
  ledControll.setMode('auto');
  ledControll.setTick(secondInCycle);
  await ledControll.apply();
  await audioScenario.tickAudio(secondInCycle);
  lastModule = '2';
}

async function tick() {
  try {
    const now = new Date();
    const event = findActiveEvent(now);
    if (!event) {
      await applyModuleNone();
      return;
    }

    const moduleId = resolveModule(event);
    const secondInCycle = computeSecondInCycle(event, now);

    if (moduleId === '1') {
      await applyModule1();
    } else if (moduleId === '2') {
      await applyModule2(secondInCycle);
    } else {
      await applyModuleNone();
    }
  } catch (e) {
    console.error('[scheduler] Tick-Fehler:', e?.message || e);
  }
}

export async function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log('[scheduler] gestartet (Polling %d ms)', POLL_INTERVAL_MS);
}

export async function stopScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  lastModule = null;
  console.log('[scheduler] gestoppt');
}

export default {
  start: startScheduler,
  stop: stopScheduler
};
