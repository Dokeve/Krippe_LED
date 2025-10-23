// public/js/statusbar.js
(function(){
  const modeEl = () => document.getElementById('status-mode-value');
  const ledEl = () => document.getElementById('status-led-value');
  const audioEl = () => document.getElementById('status-audio-value');
  const calEl = () => document.getElementById('status-calendar-value');
  const scenEl = () => document.getElementById('status-scenario-value');
  const bachlaufEl = () => document.getElementById('status-bachlauf-value');

  function safeText(node, txt){ if(!node) return; try{ node.textContent = txt; }catch(_){} }

  async function fetchStatus(){
    try{
      const r = await fetch('/api/status', { cache: 'no-store' });
      if(!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const j = await r.json();

      // Prefer persistedMode (on/off/auto) over inferred module-based label when present
      const persisted = j.persistedMode;
      const modeShort = typeof persisted === 'string' ? (persisted === 'auto' ? 'Auto' : (persisted === 'on' ? 'AN' : 'AUS'))
                        : (j.module === '2' ? 'Auto' : (j.module === '1' ? 'AN' : (j.module === null ? 'AUS' : String(j.module))));
      safeText(modeEl(), modeShort);

      const ledLabel = typeof persisted === 'string'
        ? (persisted === 'auto' ? (j.module === '2' ? 'Auto (Modul 2)' : 'Auto') : (persisted === 'on' ? 'AN' : 'AUS'))
        : (j.module === '2' ? 'Auto (Modul 2)' : (j.module === '1' ? 'AN (Modul 1)' : (j.module === null ? 'AUS' : String(j.module))));
      safeText(ledEl(), ledLabel);

      try{
        const audio = j.audio || {};
        let audioText = '—';
        if (audio.speechActive && audio.speechFile) {
          audioText = 'Speech: ' + audio.speechFile.split(/\\|\//).pop();
        } else if (audio.backgroundFile || audio.bgmFile) {
          audioText = 'BGM: ' + (audio.backgroundFile||audio.bgmFile).split(/\\|\//).pop();
        }
        safeText(audioEl(), audioText);
      }catch(e){ safeText(audioEl(), '—'); }

      safeText(calEl(), j.module ? 'OK' : 'kein Ereignis');

      if (scenEl()){
        if (j.module === '2' && j.scenario) {
          const sec = Number.isFinite(Number(j.scenario.second)) ? Math.round(j.scenario.second) : j.scenario.second;
          safeText(scenEl(), `${j.scenario.name} — Sek ${sec}/${j.scenario.duration}s`);
        } else {
          safeText(scenEl(), '');
        }
      }

      // Bachlauf status (if provided by server)
      if (bachlaufEl()) {
        const b = j.bachlauf || {};
        const running = b.running ? 'AN' : 'AUS';
        let extra = '';
        if (typeof b.autoOffRemaining === 'number') extra += ' auto:'+b.autoOffRemaining+'s';
        if (typeof b.manualHoldRemaining === 'number') extra += ' hold:'+b.manualHoldRemaining+'s';
        if (b.manualHold) extra += ' manual';
        safeText(bachlaufEl(), running + (extra ? (' (' + extra.trim() + ')') : ''));
      }

    }catch(err){
      // On error, write a compact message into the top-level status bar if present
      const node = document.getElementById('status-bar');
      const modeNode = document.getElementById('status-mode-value');
      if(modeNode) safeText(modeNode, 'n/a');
      if(node && !node.dataset.errorShown) {
        try{
          const err = document.createElement('span');
          err.className = 'status-error';
          err.textContent = 'Status: nicht verfügbar';
          node.appendChild(err);
          node.dataset.errorShown = '1';
        }catch(_){/* ignore */}
      }
    }
  }

  fetchStatus();
  setInterval(fetchStatus, 1000);
  window.addEventListener('load', fetchStatus);
  // signal that this script is the authoritative statusbar writer
  try { window.NATIVITY_STATUSBAR = true; } catch(_) {}
})();