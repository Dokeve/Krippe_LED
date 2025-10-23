// public/js/star.js
// Letzte Änderung: 02.09.2025 11:25 Uhr
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const logEl = $('log-output');
  const log = (m) => { console.log(m); if (logEl) { logEl.textContent += '\n' + m; } };

  const enabledEl = $('star-enabled');
  const distEl = $('distance-cm');
  const sdEl = $('start-date');
  const edEl = $('end-date');
  const dsEl = $('daily-start');
  const deEl = $('daily-end');

  const daysEl = $('calc-days');
  const cmDayEl = $('calc-cm-day');
  const secDayEl = $('calc-seconds-day');
  const spdEl = $('calc-speed');

  function toInt(v, def=0){ const n = Number(v); return Number.isFinite(n) ? n : def; }

  function parseTimeHHMM(t) {
    // returns seconds from 00:00
    if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
    const [hh, mm] = t.split(':').map(Number);
    return hh*3600 + mm*60;
    // Sekundenanteil nicht nötig
  }

  function daysInclusive(startISO, endISO) {
    if (!startISO || !endISO) return 0;
    const a = new Date(startISO + 'T00:00:00');
    const b = new Date(endISO + 'T00:00:00');
    const diff = Math.floor((b - a) / 86400000) + 1;
    return Math.max(0, diff);
  }

  function recompute() {
    const distanceCm = toInt(distEl.value, 0);
    const startDate = sdEl.value || '';
    const endDate = edEl.value || '';
    const tStart = parseTimeHHMM(dsEl.value);
    const tEnd = parseTimeHHMM(deEl.value);

    const days = daysInclusive(startDate, endDate);
    const secondsPerDay = (tStart != null && tEnd != null && tEnd > tStart) ? (tEnd - tStart) : 0;

    let cmPerDay = 0;
    let cmPerSec = 0;
    if (days > 0 && secondsPerDay > 0 && distanceCm > 0) {
      cmPerDay = distanceCm / days;
      cmPerSec = cmPerDay / secondsPerDay;
    }

    daysEl.value = days;
    secDayEl.value = secondsPerDay;
    cmDayEl.value = (cmPerDay ? cmPerDay.toFixed(2) : '0.00');
    spdEl.value = (cmPerSec ? cmPerSec.toFixed(4) : '0.0000');
  }

  [distEl, sdEl, edEl, dsEl, deEl].forEach(el => el?.addEventListener('input', recompute));

  async function loadConfig() {
    try {
      const r = await fetch('/api/star', { cache: 'no-store' });
      if (!r.ok) throw new Error(`/api/star ${r.status}`);
      const cfg = await r.json();

      enabledEl.value = String(!!cfg.enabled);
      distEl.value = cfg.distanceCm ?? '';
      sdEl.value = cfg.startDate ?? '';
      edEl.value = cfg.endDate ?? '';
      dsEl.value = cfg.dailyStart ?? '19:00';
      deEl.value = cfg.dailyEnd ?? '19:30';

      // Server liefert computed optional mit
      if (cfg.computed) {
        daysEl.value = cfg.computed.days ?? '';
        cmDayEl.value = (cfg.computed.cmPerDay ?? 0).toFixed(2);
        secDayEl.value = cfg.computed.secondsPerDay ?? '';
        spdEl.value = (cfg.computed.speedCmPerSec ?? 0).toFixed(4);
      } else {
        recompute();
      }

      log('[OK] Stern-Konfiguration geladen.');
    } catch (e) {
      log('❌ Laden fehlgeschlagen: ' + e.message);
    }
  }

  async function saveConfig() {
    try {
      const payload = {
        enabled: (enabledEl.value === 'true'),
        distanceCm: toInt(distEl.value, 0),
        startDate: sdEl.value || null,
        endDate: edEl.value || null,
        dailyStart: dsEl.value || null,
        dailyEnd: deEl.value || null
      };
      const r = await fetch('/api/star', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(`/api/star ${r.status}`);
      const res = await r.json();

      // Nach Serverberechnung Felder aktualisieren
      if (res.computed) {
        daysEl.value = res.computed.days ?? '';
        cmDayEl.value = (res.computed.cmPerDay ?? 0).toFixed(2);
        secDayEl.value = res.computed.secondsPerDay ?? '';
        spdEl.value = (res.computed.speedCmPerSec ?? 0).toFixed(4);
      } else {
        recompute();
      }

      log('[OK] Stern-Konfiguration gespeichert.');
    } catch (e) {
      log('❌ Speichern fehlgeschlagen: ' + e.message);
    }
  }

  $('save-star')?.addEventListener('click', saveConfig);

  // Init
  loadConfig().then(recompute);
});
