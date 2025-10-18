// public/js/bachlauf.js
document.addEventListener('DOMContentLoaded', () => {
  const statusPre = document.getElementById('bachlauf-status');
  const testBtn = document.getElementById('test-pulse');
  const startBtn = document.getElementById('start-pump');
  const stopBtn = document.getElementById('stop-pump');
  const durationInp = document.getElementById('test-duration');

  async function refresh() {
    try {
      const res = await fetch('/api/bachlauf/status');
      const json = await res.json();
      statusPre.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      statusPre.textContent = 'Status nicht verfügbar: ' + e.message;
    }
  }

  testBtn?.addEventListener('click', async () => {
    const s = Number(durationInp?.value) || 5;
    if (!confirm('Achtung: Test startet die Pumpe für ' + s + ' Sekunden. Weiter?')) return;
    try {
      const res = await fetch('/api/bachlauf/test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ seconds: s }) });
      const j = await res.json();
      alert('Test gestartet: ' + JSON.stringify(j));
      setTimeout(refresh, 500);
    } catch (e) { alert('Fehler: ' + e.message); }
  });

  startBtn?.addEventListener('click', async () => {
    if (!confirm('Bachlauf starten (läuft bis Sie auf Stopp drücken)?')) return;
    try {
      // Send start without duration => indefinite until stop
      const res = await fetch('/api/bachlauf/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
      const j = await res.json();
      alert('Start: ' + JSON.stringify(j));
      refresh();
    } catch (e) { alert('Fehler: ' + e.message); }
  });

  stopBtn?.addEventListener('click', async () => {
    if (!confirm('Pumpe stoppen?')) return;
    try {
      const res = await fetch('/api/bachlauf/stop', { method: 'POST' });
      const j = await res.json();
      alert('Stop: ' + JSON.stringify(j));
      refresh();
    } catch (e) { alert('Fehler: ' + e.message); }
  });

  setInterval(refresh, 1000);
  refresh();
});