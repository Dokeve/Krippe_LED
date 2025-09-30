// public/js/calendar.js
// Letzte Änderung: 02.09.2025 13:22 Uhr
// Features: Serie (wöchentlich), Klick→Formular, Update, Löschen EINZEL/Serie (UI immer sichtbar; Serie-Option bei Nicht-Serie deaktiviert), Sofort-Render
document.addEventListener("DOMContentLoaded", () => {
  const logOutput = document.getElementById("log-output");
  const log = (m) => { 
    console.log(m); 
    if (!logOutput) return;
    logOutput.textContent = (logOutput.textContent ? logOutput.textContent + "\n" : "") + m; 
  };

  const calendarEl = document.getElementById("calendar");
  const moduleSelect = document.getElementById("module-select");
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const startTimeInput = document.getElementById("start-time");
  const endTimeInput = document.getElementById("end-time");
  const saveButton = document.getElementById("save-calendar-settings");

  // Serie
  const recurEnabled = document.getElementById("recur-enabled");
  const recurUntil = document.getElementById("recur-until");

  // Bearbeitung/Löschen
  const currentIdInput = document.getElementById("current-id");
  const currentSeriesRootInput = document.getElementById("current-series-root");
  const deleteButton = document.getElementById("delete-calendar-entry");
  const resetButton = document.getElementById("reset-form");
  const deleteScopeSeriesWrap = document.getElementById("delete-scope-series-wrap");
  const deleteScopeSeriesRadio = document.getElementById("delete-scope-series-radio");
  const deleteScopeHint = document.getElementById("delete-scope-hint");

  recurEnabled?.addEventListener('change', () => {
    if (!recurUntil) return;
    recurUntil.disabled = !recurEnabled.checked;
    if (!recurEnabled.checked) recurUntil.value = '';
  });

  // Initial: Serien-Option deaktiviert bis Event ausgewählt ist
  setSeriesDeleteOption(null);

  let calendar; // FullCalendar-Instanz

  /* ----------------- Helpers ----------------- */
  const pad = (n) => String(n).padStart(2, '0');

  function toLocalISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = pad(dateObj.getMonth() + 1);
    const d = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const mm = pad(dateObj.getMinutes());
    const ss = pad(dateObj.getSeconds());
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }

  function combineLocalDateTime(dateStr, timeStr) {
    const t = timeStr || '00:00';
    const [h, m] = t.split(':').map(x=>parseInt(x,10));
    const [y, mo, d] = dateStr.split('-').map(x=>parseInt(x,10));
    return new Date(y, (mo-1), d, h||0, m||0, 0, 0);
  }

  function splitToDateTimeStrings(isoLike) {
    const dt = new Date(isoLike);
    const date = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    return { date, time };
  }

  function synthId() {
    return 'e' + Date.now() + '-' + Math.floor(Math.random()*1e6);
  }
  function getSeriesRootFromId(id) {
    if (!id) return null;
    const i = id.indexOf('-');
    return i > 0 ? id.slice(0, i) : null;
  }

  function setSeriesDeleteOption(seriesRoot) {
    // Wenn seriesRoot vorhanden → Option „Ganze Serie“ aktiv; sonst deaktiviert.
    const isSeries = !!seriesRoot;
    if (isSeries) {
      deleteScopeSeriesWrap.style.opacity = '1';
      deleteScopeSeriesRadio.disabled = false;
      deleteScopeHint.textContent = 'Serien-Event erkannt.';
    } else {
      // Deaktivieren und auf Einzeltermin zurücksetzen
      deleteScopeSeriesWrap.style.opacity = '.5';
      deleteScopeSeriesRadio.disabled = true;
      const single = document.querySelector('input[name="delete-scope"][value="one"]');
      if (single) single.checked = true;
      deleteScopeHint.textContent = 'Kein Serien-Event ausgewählt.';
    }
  }

  async function apiGetCalendar() {
    const r = await fetch('/api/calendar', { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET /api/calendar ${r.status}`);
    return r.json();
  }

  async function apiSaveCalendar(arr) {
    // 1) PUT
    try {
      const r = await fetch('/api/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr)
      });
      if (!r.ok) throw new Error(`PUT /api/calendar ${r.status}`);
      return r.json();
    } catch (e) {
      // 2) Fallback POST
      log(`POST-Fallback auf PUT: ${e.message}`);
      const r2 = await fetch('/api/calendar/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr)
      });
      if (!r2.ok) throw new Error(`POST /api/calendar/save ${r2.status}`);
      return r2.json();
    }
  }

  // Adjazente Termine bleiben bestehen (nur echte Überlappung wird verdrängt)
  function mergeWithPrecedence(existing, newcomer) {
    const nx = [];
    const startB = new Date(newcomer.start).getTime();
    const endB = new Date(newcomer.end || newcomer.start).getTime();

    for (const ev of existing) {
      const startA = new Date(ev.start).getTime();
      const endA = new Date(ev.end || ev.start).getTime();
      const overlap = endA > startB && endB > startA;
      if (overlap) continue; // neuer verdrängt
      nx.push(ev);
    }
    nx.push(newcomer);
    return nx.sort((a,b)=> new Date(a.start) - new Date(b.start));
  }

  function generateWeeklySeries(baseEntry, untilDate) {
    const out = [];
    const baseStart = new Date(baseEntry.start);
    const baseEnd = new Date(baseEntry.end || baseEntry.start);
    const endBoundary = new Date(untilDate.getFullYear(), untilDate.getMonth(), untilDate.getDate(), 23, 59, 59, 999);

    let k = 0;
    const baseId = baseEntry.id || synthId(); // Root-ID der Serie
    while (true) {
      const s = new Date(baseStart.getTime() + k * 7 * 24 * 60 * 60 * 1000);
      if (s > endBoundary) break;
      const e = new Date(baseEnd.getTime() + k * 7 * 24 * 60 * 60 * 1000);
      out.push({
        id: `${baseId}-${k}`,
        module: baseEntry.module,
        title: baseEntry.title,
        start: toLocalISO(s),
        end: toLocalISO(e),
        allDay: baseEntry.allDay === true ? true : false,
        seriesRoot: baseId,
        seriesIndex: k
      });
      k++;
      if (k > 520) break; // ~10 Jahre Schutz
    }
    return out;
  }

  function mapEventsForCalendar(arr) {
    return (arr || []).map((ev, i) => ({
      id: ev.id || String(i),
      title: ev.title || ('Modul ' + (ev.module || '1')),
      start: ev.start,
      end: ev.end || null,
      allDay: ev.allDay === true ? true : false,
      color: (String(ev.module) === '1' ? 'gold' : 'royalblue'),
      extendedProps: { module: ev.module, seriesRoot: ev.seriesRoot ?? getSeriesRootFromId(ev.id) }
    }));
  }

  function immediateRender(arr) {
    if (!calendar) return;
    calendar.batchRendering(() => {
      calendar.removeAllEvents();
      const mapped = mapEventsForCalendar(arr);
      mapped.forEach(ev => calendar.addEvent(ev));
    });
  }

  function clearForm() {
    currentIdInput.value = '';
    currentSeriesRootInput.value = '';
    moduleSelect.value = '1';
    startDateInput.value = '';
    startTimeInput.value = '00:00';
    endDateInput.value = '';
    endTimeInput.value = '23:59';
    recurEnabled.checked = false;
    recurUntil.disabled = true;
    recurUntil.value = '';
    setSeriesDeleteOption(null);
  }

  /* ----------------- FullCalendar ----------------- */
  function renderCalendar() {
    if (!calendarEl || !window.FullCalendar) { log("[SIMULATION] FullCalendar nicht verfügbar"); return; }

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'de',
      selectable: true,
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
      events: async (info, success, failure) => {
        try {
          const arr = await apiGetCalendar();
          success(mapEventsForCalendar(arr));
        } catch (e) {
          failure(e);
          log('❌ Kalenderdaten konnten nicht geladen werden: ' + e.message);
        }
      },
      dateClick: function(info) {
        if (!startDateInput.value) startDateInput.value = info.dateStr;
        else if (!endDateInput.value) endDateInput.value = info.dateStr;
      },
      eventClick: async function(info) {
        try {
          const ev = info.event;
          currentIdInput.value = ev.id || '';
          const sroot = ev.extendedProps?.seriesRoot || getSeriesRootFromId(ev.id);
          currentSeriesRootInput.value = sroot || '';

          moduleSelect.value = String(ev.extendedProps?.module || (ev.title?.includes('2') ? '2' : '1'));
          const s = splitToDateTimeStrings(ev.start);
          startDateInput.value = s.date;
          startTimeInput.value = s.time;
          const end = ev.end || ev.start;
          const e2 = splitToDateTimeStrings(end);
          endDateInput.value = e2.date;
          endTimeInput.value = e2.time;

          setSeriesDeleteOption(sroot);

          log(`[OK] Termin ausgewählt: ${ev.title} (${s.date} ${s.time} → ${e2.date} ${e2.time})${sroot ? ' [Serie]' : ''}`);
        } catch (e) {
          log('❌ Konnte Termin nicht ins Formular übernehmen: ' + e.message);
        }
      }
    });

    calendar.render();
  }

  if (typeof FullCalendar === 'undefined') {
    const chk = setInterval(() => {
      if (typeof FullCalendar !== 'undefined') { clearInterval(chk); renderCalendar(); }
    }, 100);
  } else {
    renderCalendar();
  }

  /* ----------------- Save / Update ----------------- */
  saveButton?.addEventListener("click", async () => {
    try {
      if (!startDateInput.value || !endDateInput.value) throw new Error('Start- und Enddatum erforderlich');

      const start = combineLocalDateTime(startDateInput.value, startTimeInput.value || '00:00');
      const end = combineLocalDateTime(endDateInput.value, endTimeInput.value || '23:59');
      if (end < start) throw new Error('Ende liegt vor Start');

      const baseEntry = {
        id: currentIdInput.value || synthId(),
        module: moduleSelect.value,
        title: 'Modul ' + moduleSelect.value,
        start: toLocalISO(start),
        end: toLocalISO(end),
        allDay: false
      };

      // Bestehende Daten holen
      let arr = await apiGetCalendar();

      // Beim Bearbeiten: alten Eintrag(e) entfernen
      const oldId = currentIdInput.value;
      if (oldId) {
        arr = arr.filter(ev => ev.id !== oldId);
      }

      // Single oder Serie
      if (recurEnabled?.checked) {
        if (!recurUntil?.value) throw new Error('Serienende fehlt');
        const until = new Date(recurUntil.value + 'T00:00:00');
        if (until < new Date(startDateInput.value + 'T00:00:00')) throw new Error('Serienende vor Startdatum');

        const series = generateWeeklySeries(baseEntry, until);
        for (const ev of series) arr = mergeWithPrecedence(arr, ev);
      } else {
        arr = mergeWithPrecedence(arr, baseEntry);
      }

      // Persistieren
      const res = await apiSaveCalendar(arr);
      log(`[OK] Gespeichert (${res.count ?? arr.length})`);

      // Sofort im UI anzeigen
      immediateRender(arr);

      // Formular reset
      clearForm();
    } catch (e) {
      log('❌ Speichern fehlgeschlagen: ' + e.message);
    }
  });

  /* ----------------- Delete (Einzel/Serie) ----------------- */
  deleteButton?.addEventListener('click', async () => {
    try {
      let scope = 'one';
      const sel = document.querySelector('input[name="delete-scope"]:checked');
      if (sel && sel.value) scope = sel.value;

      let arr = await apiGetCalendar();

      const curId = currentIdInput.value;
      const seriesRoot = currentSeriesRootInput.value || getSeriesRootFromId(curId);

      if (!curId && scope === 'one') {
        throw new Error('Kein Termin ausgewählt.');
      }

      if (scope === 'series' && seriesRoot) {
        // ganze Serie entfernen: alle mit gleicher Root
        const before = arr.length;
        arr = arr.filter(ev => !( (ev.seriesRoot && ev.seriesRoot === seriesRoot) || (ev.id && ev.id.startsWith(seriesRoot + '-')) ));
        if (arr.length === before) log('Hinweis: Keine Serienereignisse gefunden (id/seriesRoot).');
      } else {
        // nur dieses Ereignis entfernen
        if (curId) {
          arr = arr.filter(ev => ev.id !== curId);
        } else {
          // Fallback über Feldwerte (falls historisches Event ohne id)
          const start = toLocalISO(combineLocalDateTime(startDateInput.value, startTimeInput.value || '00:00'));
          const end = toLocalISO(combineLocalDateTime(endDateInput.value, endTimeInput.value || '23:59'));
          const title = 'Modul ' + moduleSelect.value;
          arr = arr.filter(ev => !(ev.title===title && ev.start===start && (ev.end||null)===(end||null)));
        }
      }

      const res = await apiSaveCalendar(arr);
      log(`[OK] Gelöscht (${scope === 'series' ? 'Serie' : 'Einzeltermin'}; verbleibend: ${res.count ?? arr.length})`);

      immediateRender(arr);
      clearForm();
    } catch (e) {
      log('❌ Löschen fehlgeschlagen: ' + e.message);
    }
  });

  /* ----------------- Reset ----------------- */
  resetButton?.addEventListener('click', () => clearForm());

  log("[OK] Calendar JS (Löschumfang: Einzeltermin oder ganze Serie) initialisiert");
});
