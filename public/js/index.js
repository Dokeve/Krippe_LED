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


  // Status polling is handled centrally by public/js/statusbar.js

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
