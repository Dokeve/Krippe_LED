// routes/status.js
import { Router } from 'express';
import { getCalendarEvents } from '../services/calendar-store.js';
import { getActiveScenarioAt, totalCycleSeconds } from '../services/scenario-controll.js';
import audioScenario from '../services/audio-scenario.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// try to load bachlauf service if present
let bachlaufService = null;
try {
  const bPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'services', 'bachlauf.js');
  if (fs.existsSync(bPath)) {
    // dynamic import to avoid hard circular deps
    // eslint-disable-next-line no-await-in-loop
    const mod = await import(pathToFileURL(bPath).href);
    bachlaufService = mod.default ?? mod;
  }
} catch (e) {
  // ignore if not present
}

const router = Router();

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

router.get('/', (_req, res) => {
  try {
    const now = new Date();
    const event = findActiveEvent(now);
    const moduleId = resolveModule(event);
    const audio = audioScenario?.getAudioStatus?.() || {};
    if (moduleId === '2') {
      const secondInCycle = Math.round(computeSecondInCycle(event, now));
      const scenario = getActiveScenarioAt(secondInCycle);
      const out = { module: '2', scenario, secondInCycle, audio };
      if (bachlaufService && typeof bachlaufService.getStatus === 'function') {
        const b = bachlaufService.getStatus();
        out.bachlauf = {
          running: b.pumpState === 'on',
          pumpState: b.pumpState,
          source: b.source,
          manualOverride: b.manualOverride
        };
      }
      return res.json(out);
    }
    const out = { module: moduleId, scenario: null, audio };
    if (bachlaufService && typeof bachlaufService.getStatus === 'function') {
      const b = bachlaufService.getStatus();
      out.bachlauf = {
        running: b.pumpState === 'on',
        pumpState: b.pumpState,
        source: b.source,
        manualOverride: b.manualOverride
      };
    }
    return res.json(out);
  } catch (error) {
    res.status(500).json({ error: 'Status konnte nicht ermittelt werden', detail: error?.message || String(error) });
  }
});

export default router;
