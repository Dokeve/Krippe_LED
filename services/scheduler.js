// services/scheduler.js
// Zentraler Scheduler (ESM) – pollt Kalender, steuert LED/Audio (TODO: volle Implementierung)
import { query } from './db.js';
import ws2812 from './ws2812.js';
import audioScenario from './audio-scenario.js';

const POLL_INTERVAL_MS = 5000; // TODO: konfigurierbar machen (config.scheduler?)
let timer = null;

async function fetchActiveCalendarEntry(nowIso) {
  // TODO: SELECT nach finaler Tabellenstruktur anpassen
  const rows = await query?.(
    'SELECT * FROM calendar_event WHERE start <= :now AND (`end` IS NULL OR `end` > :now) ORDER BY start DESC LIMIT 1',
    { now: nowIso }
  );
  return rows?.[0] ?? null;
}

function determineModuleFromEntry(entry) {
  const title = String(entry?.title || '').toLowerCase();
  const module = {
    module1: title.includes('modul 1'),
    module2: title.includes('modul 2')
  };
  return module;
}

async function ensureLedsInitialized(count) {
  try {
    await ws2812.initLEDs?.(count);
  } catch (e) {
    console.warn('[scheduler] LED-Init fehlgeschlagen:', e?.message || e);
  }
}

async function handleModule1(/* entry */) {
  // Platzhalter: Modul 1 = alle LEDs auf Grundfarbe
  await ensureLedsInitialized(1000); // TODO: count aus config/DB holen
  // TODO: LED-Gruppen/Grundfarben anwenden (db.getLed / led-controll)
}

async function handleModule2(/* entry */) {
  // Platzhalter: Modul 2 = Szenario-Zyklus inkl. Audio
  await ensureLedsInitialized(1000);
  // TODO: Aktuelles Szenario bestimmen (Tag/Tag-Nacht/Nacht/Nacht-Tag)
  // TODO: led-controll.apply() + audioScenario.tickAudio()
}

async function tick() {
  try {
    const nowIso = new Date().toISOString();
    const entry = await fetchActiveCalendarEntry(nowIso);
    if (!entry) return;

    const module = determineModuleFromEntry(entry);
    if (module.module1) await handleModule1(entry);
    if (module.module2) await handleModule2(entry);
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
  console.log('[scheduler] gestoppt');
}

export default {
  start: startScheduler,
  stop: stopScheduler
};
