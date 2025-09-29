import { getDB } from './db.js';
import { Log } from './log.js';
import * as Scn from './scenarios.js';

let timer = null;
let lastApplied = null;

function findActiveModule(ts) {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM calendar WHERE start_ts <= ? AND end_ts >= ?').all(ts, ts);
  if (rows.length === 0) return null;
  rows.sort((a,b)=> a.start_ts - b.start_ts || a.end_ts - b.end_ts);
  let pick = rows[0];
  for (const r of rows) {
    if (r.created_at >= pick.created_at) pick = r;
  }
  return pick.module;
}

export function start(io) {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    const now = Math.floor(Date.now()/1000);
    const active = findActiveModule(now);
    if (active && active !== lastApplied) {
      try {
        await Scn.applyModule(active);
        lastApplied = active;
        io.emit('schedule', { activeModule: active, ts: now });
      } catch (e) {
        Log.error('Fehler beim Anwenden des Moduls: ' + e.message);
      }
    }
  }, 3000);
  Log.success('Scheduler gestartet (alle 3s)');
}
