// calendar.js — Serien, Edit, Delete
const $ = (s, r=document) => r.querySelector(s);

let calendar, events = [];
let selectedEventMeta = null; // { id, occurrenceStartISO }

async function fetchEvents() {
  const res = await fetch('/api/calendar').then(r=>r.json()).catch(()=>({ok:false}));
  if (!res.ok) throw new Error('load failed');
  events = res.events || [];
  return events;
}

async function saveEvents() {
  const res = await fetch('/api/calendar', {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ events })
  }).then(r=>r.json()).catch(e=>({ok:false,error:String(e)}));
  $('#log-output').textContent = res.ok ? '✅ Gespeichert' : ('❌ ' + (res.error||'Fehler'));
  return res.ok;
}

function uiFromEvent(e) {
  $('#title').value = e.title || '';
  $('#module').value = e.module || '1';
  $('#allDay').checked = !!e.allDay;
  if (e.rrule) {
    $('#isRecurring').checked = true;
    // show base start/end into inputs (ISO local)
    $('#start').value = e.start ? e.start.slice(0,16) : '';
    $('#end').value = e.end ? e.end.slice(0,16) : '';
  } else {
    $('#isRecurring').checked = false;
    $('#start').value = e.start ? e.start.slice(0,16) : '';
    $('#end').value = e.end ? e.end.slice(0,16) : '';
  }
}

function makeEventFromForm() {
  const title = $('#title').value.trim();
  const module = $('#module').value;
  const allDay = $('#allDay').checked;
  const isRecurring = $('#isRecurring').checked;
  const start = $('#start').value ? new Date($('#start').value) : null;
  const end = $('#end').value ? new Date($('#end').value) : null;
  if (!title || !start || !end) throw new Error('Bitte Titel, Start, Ende ausfüllen');
  const e = {
    id: selectedEventMeta?.id || undefined,
    title, module, allDay,
    start: start.toISOString(),
    end: end.toISOString(),
    rrule: null,
    exDates: []
  };
  if (isRecurring) {
    // Weekly forever (or until end date day-of-week)
    e.rrule = {
      freq: 'weekly'
    };
  }
  return e;
}

function upsertEvent(e) {
  const idx = events.findIndex(x => x.id === e.id);
  if (idx >= 0) events[idx] = { ...events[idx], ...e };
  else {
    e.id = e.id || (Date.now().toString(36)+Math.random().toString(36).slice(2));
    events.push(e);
  }
}

async function onSave() {
  try {
    const e = makeEventFromForm();
    upsertEvent(e);
    await saveEvents();
    calendar.refetchEvents();
    selectedEventMeta = null;
    $('#deleteOccurrence').disabled = true;
    $('#deleteSeries').disabled = true;
  } catch (err) {
    $('#log-output').textContent = '❌ ' + err.message;
  }
}

async function deleteScope(scope) {
  if (!selectedEventMeta) return;
  const payload = { scope, id: selectedEventMeta.id };
  if (scope === 'occurrence') payload.occurrenceStartISO = selectedEventMeta.occurrenceStartISO;
  const res = await fetch('/api/calendar/delete', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  }).then(r=>r.json()).catch(e=>({ok:false,error:String(e)}));
  $('#log-output').textContent = res.ok ? '🗑 gelöscht' : ('❌ ' + (res.error||'Fehler'));
  if (res.ok) { await fetchEvents(); calendar.refetchEvents(); }
  selectedEventMeta = null;
  $('#deleteOccurrence').disabled = true;
  $('#deleteSeries').disabled = true;
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchEvents();
  const calEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calEl, {
    height: 'auto',
    initialView: 'timeGridWeek',
    nowIndicator: true,
    editable: false,
    selectable: true,
    eventSources: [{
      events: (info, success) => {
        // translate stored events to FC shape
        const out = events.map(e => {
          const base = { id:e.id, title:e.title, allDay: !!e.allDay };
          if (e.rrule) {
            base.rrule = { freq:'weekly' };
            if (Array.isArray(e.exDates) && e.exDates.length) base.exdate = e.exDates;
            base.duration = e.end && e.start ? (new Date(e.end)-new Date(e.start))+'ms' : null;
            return base;
          } else {
            base.start = e.start;
            base.end = e.end;
            return base;
          }
        });
        success(out);
      }
    }],
    eventClick: (info) => {
      // populate form from clicked event; remember occurrence start
      const evId = info.event.id;
      const base = events.find(e => e.id === evId);
      if (!base) return;
      selectedEventMeta = { id: evId, occurrenceStartISO: info.event.start?.toISOString() || null };
      uiFromEvent({
        ...base,
        // use occurrence start/end if present
        start: info.event.start?.toISOString() || base.start,
        end: info.event.end?.toISOString() || base.end
      });
      $('#deleteOccurrence').disabled = !base.rrule;
      $('#deleteSeries').disabled = !base.rrule;
    }
  });
  calendar.render();

  document.getElementById('save').addEventListener('click', onSave);
  document.getElementById('deleteOccurrence').addEventListener('click', () => deleteScope('occurrence'));
  document.getElementById('deleteSeries').addEventListener('click', () => deleteScope('series'));
});
