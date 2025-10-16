// public/js/index.js
// Letzte Änderung: 02.09.2025 10:35 Uhr (Lokale Zeiten im Startseiten-Kalender)
document.addEventListener('DOMContentLoaded', () => {
  const logEl = document.getElementById('log-output');
  function log(m) {
    const ts = new Date().toLocaleString();
    if (logEl) { logEl.textContent += `[${ts}] ${m}\n`; logEl.scrollTop = logEl.scrollHeight; }
    console.log(m);
  }

  // Unified status elements (top status bar)
  const statusModeValue = document.getElementById('status-mode-value');
  const statusLedValue = document.getElementById('status-led-value');
  const statusAudioValue = document.getElementById('status-audio-value');
  const statusCalendarValue = document.getElementById('status-calendar-value');
  const statusScenarioValue = document.getElementById('status-scenario-value');


  // Fetch a compact status: which module is active and (for module 2) the current scenario
  async function fetchStatus() {
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j = await r.json();
      // j: { module: '1'|'2'|null, scenario?: { name, second, duration } }
      // Mode / LED short labels
      const modeShort = j.module === '2' ? 'Auto' : (j.module === '1' ? 'On' : (j.module === null ? 'Off' : String(j.module)));
      if (statusModeValue) statusModeValue.textContent = modeShort;
      if (statusLedValue) statusLedValue.textContent = j.module === '2' ? 'Auto (Modul 2)' : (j.module === '1' ? 'On (Modul 1)' : (j.module === null ? 'Off' : String(j.module)));

      // Audio: prefer speech file if active, otherwise background file
      try {
        const audio = j.audio || {};
        let audioText = '—';
        if (audio.speechActive && audio.speechFile) {
          audioText = `Speech: ${audio.speechFile.split(/\\|\//).pop()}`;
        } else if (audio.backgroundFile) {
          audioText = `BGM: ${audio.backgroundFile.split(/\\|\//).pop()}`;
        }
        if (statusAudioValue) statusAudioValue.textContent = audioText;
      } catch (e) { if (statusAudioValue) statusAudioValue.textContent = '—'; }

      if (statusCalendarValue) statusCalendarValue.textContent = j.module ? 'OK' : 'kein Ereignis';

      if (statusScenarioValue) {
        if (j.module === '2' && j.scenario) {
          // server already rounds seconds; ensure integer display
          const sec = Number.isFinite(Number(j.scenario.second)) ? Math.round(j.scenario.second) : j.scenario.second;
          statusScenarioValue.textContent = `${j.scenario.name} — Sek ${sec}/${j.scenario.duration}s`;
        } else {
          statusScenarioValue.textContent = '';
        }
      }
    } catch (e) { log('Status konnte nicht geladen werden: ' + e.message); }
  }

  // initial fetch and periodic polling (10s)
  fetchStatus();
  setInterval(fetchStatus, 10000);

  async function setMode(mode){
    try{
      const r = await fetch('/api/mode', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mode}) });
      const j = await r.json();
      // update unified status bar mode display instead of removed current-mode element
      if (statusModeValue) statusModeValue.textContent = (j.mode === 'auto' ? 'Auto' : (j.mode === 'on' ? 'On' : (j.mode === 'off' ? 'Off' : j.mode)));
      log('Modus gesetzt: ' + j.mode);
    }catch(e){ log('Modus-Setzen fehlgeschlagen: ' + e.message); }
  }
  document.getElementById('led-on')?.addEventListener('click',()=>setMode('on'));
  document.getElementById('led-off')?.addEventListener('click',()=>setMode('off'));
  document.getElementById('led-auto')?.addEventListener('click',()=>setMode('auto'));

  // --- Helpers: Eingehende start/end robust lokal darstellen ---
  // Normalisiert:
  //  - "2025-12-24T18:00Z" (UTC)  -> "2025-12-24T19:00" (Beispiel: CET) als lokale, Z-lose ISO
  //  - "2025-12-24T18:00+02:00"   -> lokale, Z-lose ISO
  //  - "2025-12-24T18:00"         -> bleibt unverändert
  function toLocalNaiveISO(s) {
    if (!s) return s;
    // Wenn bereits naive lokale Form (kein Z/Offset) -> zurückgeben
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const pad = (n)=>String(n).padStart(2,'0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const MM = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
  }

  // Kalender – Wochenansicht auf der Startseite
  const calEl = document.getElementById('calendar');
  function renderCalendar() {
    if (!calEl || !window.FullCalendar) { log('[SIMULATION] FullCalendar nicht verfügbar'); return; }
    const cal = new FullCalendar.Calendar(calEl, {
      initialView:'timeGridWeek',
      locale:'de',
      headerToolbar:{ left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek,timeGridDay' },
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
      events: async (_info,success,failure)=>{
        try{
          const r = await fetch('/api/calendar', { cache:'no-store' }); 
          const arr = await r.json();
          const mapped = (arr||[]).map((ev,i)=>({
            id: ev.id || String(i),
            title: ev.title || ('Modul ' + (ev.module || '1')),
            start: toLocalNaiveISO(ev.start),
            end: ev.end ? toLocalNaiveISO(ev.end) : null,
            allDay: ev.allDay !== false,
            color: (ev.module === '1' ? 'gold' : 'royalblue')
          }));
          success(mapped);
          document.getElementById('calendar-status')?.replaceChildren(document.createTextNode('OK'));
        }catch(e){
          failure(e);
          log('Kalender konnte nicht geladen werden: ' + e.message);
          document.getElementById('calendar-status')?.replaceChildren(document.createTextNode('Fehler'));
        }
      }
    });
    cal.render();
  }

  // Wenn Fallback JS dynamisch nachgeladen wird, warten bis es verfügbar ist
  if (typeof FullCalendar === 'undefined') {
    const chk = setInterval(()=>{ if (typeof FullCalendar !== 'undefined'){ clearInterval(chk); renderCalendar(); }}, 100);
  } else { renderCalendar(); }
});
