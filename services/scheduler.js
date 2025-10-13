// services/scheduler.js
// Zentraler Scheduler - nutzt File-Stores (Kalender/LED/Audio)
import config from '../config.js';
import { getCalendarEvents } from './calendar-store.js';
import * as ledControll from './led-controll.js';
import ws2812 from './ws2812.js';
import audioScenario from './audio-scenario.js';
import { getActiveScenarioAt, totalCycleSeconds } from './scenario-controll.js';
import { getMode as readPersistedMode } from './mode-store.js';

const POLL_INTERVAL_MS = 500;
let timer = null;
let lastModule = null;      // '1' | '2' | null
let lastLogModule = null;
let lastLogScenario = null;
let lastManualMode = null;

async function ensureLedsInitialized() {
  try {
    await ws2812.initLEDs(config.led.count);
  } catch (error) {
    console.warn('[scheduler] LED-Init fehlgeschlagen:', error?.message || error);
  }
}

function findActiveEvent(now) {
  const events = getCalendarEvents();
  let active = null;
  for (const event of events) {
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : start;
    if (Number.isNaN(start.getTime())) continue;
    if (start <= now && now <= end) {
      if (!active || new Date(active.start) < start) {
        active = event;
      }
    }
  }
  return active;
}

function resolveModule(event) {
  if (!event) return null;
  const module = event.module || event.moduleId;
  if (module === '1' || module === '2') return module;
  const title = String(event.title || '').toLowerCase();
  if (title.includes('modul 2')) return '2';
  if (title.includes('modul 1')) return '1';
  return null;
}

function computeSecondInCycle(event, now) {
  if (!event) return 0;
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = Math.max(0, (now - start) / 1000);
  const total = totalCycleSeconds();
  if (total <= 0) return diff;
  return diff % total;
}

function logPhase(moduleId, scenario) {
  const scenarioName = scenario?.name ?? 'n/a';
  if (lastLogModule === moduleId && lastLogScenario === scenarioName) {
    return;
  }
  const detail = scenario ? `${scenario.name} (${scenario.second}/${scenario.duration}s)` : 'kein Szenario';
  console.log(`[scheduler] Modul ${moduleId ?? 'none'} - ${detail}`);
  lastLogModule = moduleId ?? null;
  lastLogScenario = scenarioName;
}

async function applyModuleNone() {
  if (lastModule === null) {
    logPhase(null, null);
    return;
  }
  ledControll.setMode('off');
  await ledControll.applyModuleOff();
  audioScenario.stopBackground();
  lastModule = null;
  logPhase(null, null);
}

async function applyModule1() {
  if (lastModule !== '1') {
    await ensureLedsInitialized();
    ledControll.setMode('on');
    await ledControll.apply();
    audioScenario.stopBackground();
    lastModule = '1';
    logPhase('1', null);
  }
}

async function applyModule2(secondInCycle) {
  await ensureLedsInitialized();
  const scenario = getActiveScenarioAt(secondInCycle);
  ledControll.setMode('auto');
  ledControll.setTick(secondInCycle);
  await ledControll.apply();
  await audioScenario.tickAudio(secondInCycle);
  lastModule = '2';
  logPhase('2', scenario);
}

async function tick() {
  try {
    const persistedMode = readPersistedMode();
    if (persistedMode === 'on') {
      if (lastManualMode !== 'on') {
        console.log('[scheduler] manueller Modus ON aktiv – Scheduler pausiert');
        lastManualMode = 'on';
      }
      ledControll.setMode('on');
      await ledControll.applyModuleOn();
      audioScenario.stopBackground();
      lastModule = null;
      return;
    }
    if (persistedMode === 'off') {
      if (lastManualMode !== 'off') {
        console.log('[scheduler] manueller Modus OFF aktiv – Scheduler pausiert');
        lastManualMode = 'off';
      }
      ledControll.setMode('off');
      await ledControll.applyModuleOff();
      audioScenario.stopBackground();
      lastModule = null;
      return;
    }
    lastManualMode = null;

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
  } catch (error) {
    console.error('[scheduler] Tick-Fehler:', error?.message || error);
  }
}

export async function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log('[scheduler] gestartet (Polling %d ms)', POLL_INTERVAL_MS);
  console.log('[scheduler] Zyklusgesamt', totalCycleSeconds(), 'Sekunden', config.scheduler?.cycleSeconds);
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
