// public/js/statusbar.js
(function(){
  // This is the unified statusbar implementation derived from the original
  // `public/js/index.js` status logic — kept 1:1 to preserve behavior.
  const modeEl = () => document.getElementById('status-mode-value');
  const ledEl = () => document.getElementById('status-led-value');
  const audioEl = () => document.getElementById('status-audio-value');
  const calEl = () => document.getElementById('status-calendar-value');
  const scenEl = () => document.getElementById('status-scenario-value');

  function safeText(node, txt){ if(!node) return; node.textContent = txt; }

  async function fetchStatus(){
    try{
      const r = await fetch('/api/status', { cache: 'no-store' });
      if(!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const j = await r.json();

      const modeShort = j.module === '2' ? 'Auto' : (j.module === '1' ? 'On' : (j.module === null ? 'Off' : String(j.module)));
      safeText(modeEl(), modeShort);

      safeText(ledEl(), j.module === '2' ? 'Auto (Modul 2)' : (j.module === '1' ? 'On (Modul 1)' : (j.module === null ? 'Off' : String(j.module))));

      try{
        const audio = j.audio || {};
        let audioText = '—';
        if (audio.speechActive && audio.speechFile) {
          audioText = `Speech: ${audio.speechFile.split(/\\|\//).pop()}`;
        } else if (audio.backgroundFile || audio.bgmFile) {
          audioText = `BGM: ${(audio.backgroundFile||audio.bgmFile).split(/\\|\//).pop()}`;
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
    }catch(e){
      // On error, write a compact message into the top-level status bar if present
      const node = document.getElementById('status-bar');
      if(node) node.textContent = 'Status: nicht verfügbar';
    }
  }

  fetchStatus();
  setInterval(fetchStatus, 1000);
  window.addEventListener('load', fetchStatus);
})();