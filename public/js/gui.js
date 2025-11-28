// public/js/gui.js
// Controls for the simple GUI page at /gui
document.addEventListener('DOMContentLoaded', () => {
  const modeEl = document.getElementById('status-mode');
  const bachEl = document.getElementById('status-bachlauf');
  const logEl = document.getElementById('gui-log');

  function flog(m){ if(logEl){ logEl.textContent = m; } console.log('[GUI]',m); }

  const btns = {
    ledOn: document.getElementById('led-on'),
    ledOff: document.getElementById('led-off'),
    ledAuto: document.getElementById('led-auto'),
    bachOn: document.getElementById('bach-on'),
    bachOff: document.getElementById('bach-off'),
    bachAuto: document.getElementById('bach-auto')
  };

  function setActiveButton(group, activeId){
    if(group === 'led'){
      ['led-on','led-off','led-auto'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.classList.toggle('active', id === activeId);
        el.classList.toggle('led-on', id === 'led-on');
        el.classList.toggle('led-off', id === 'led-off');
        el.classList.toggle('led-auto', id === 'led-auto');
      });
    } else if(group === 'bach'){
      ['bach-on','bach-off','bach-auto'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.classList.toggle('active', id === activeId);
        el.classList.toggle('bach-on', id === 'bach-on');
        el.classList.toggle('bach-off', id === 'bach-off');
        el.classList.toggle('bach-auto', id === 'bach-auto');
      });
    }
  }

  async function fetchMode(){
    try{
      const r = await fetch('/api/mode');
      const j = await r.json();
      const m = j?.mode || 'idle';
      modeEl.textContent = (m === 'auto' ? 'Auto' : (m === 'on' ? 'AN' : (m === 'off' ? 'AUS' : m)));
      setActiveButton('led', m === 'on' ? 'led-on' : m === 'off' ? 'led-off' : m === 'auto' ? 'led-auto' : null);
      flog('Modus: ' + m);
    }catch(e){ flog('Fehler beim Laden des Modus: ' + e.message); }
  }

  async function fetchBach(){
    try{
      const r = await fetch('/api/bachlauf/status');
      const j = await r.json();
      // Expecting something like { manualOverride: 'on'|'off'|null, running: true/false }
      const manual = j?.manualOverride ?? null;
      let label = 'Auto';
      if(manual === 'on') label = 'AN';
      if(manual === 'off') label = 'AUS';
      bachEl.textContent = label;
      setActiveButton('bach', manual === 'on' ? 'bach-on' : manual === 'off' ? 'bach-off' : 'bach-auto');
      flog('Bachlauf: ' + (manual || 'auto'));
    }catch(e){ flog('Fehler beim Laden Bachlauf: ' + e.message); }
  }

  async function setMode(mode){
    try{
      const r = await fetch('/api/mode', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mode})});
      const j = await r.json();
      const m = j?.mode || mode;
      setActiveButton('led', m === 'on' ? 'led-on' : m === 'off' ? 'led-off' : m === 'auto' ? 'led-auto' : null);
      modeEl.textContent = (m === 'auto' ? 'Auto' : (m === 'on' ? 'AN' : (m === 'off' ? 'AUS' : m)));
      flog('Modus gesetzt: ' + m);
    }catch(e){ flog('SetMode fehlgeschlagen: ' + e.message); }
  }

  async function setBach(action){
    // action: 'on'|'off'|'auto' -> map auto -> 'clear' for API
    const apiAction = action === 'auto' ? 'clear' : action;
    try{
      const r = await fetch('/api/bachlauf/manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: apiAction })});
      const j = await r.json();
      const manual = j?.manualOverride ?? (apiAction === 'clear' ? null : apiAction);
      setActiveButton('bach', manual === 'on' ? 'bach-on' : manual === 'off' ? 'bach-off' : 'bach-auto');
      bachEl.textContent = manual === 'on' ? 'AN' : manual === 'off' ? 'AUS' : 'Auto';
      flog('Bachlauf gesetzt: ' + (manual || 'auto'));
    }catch(e){ flog('SetBach fehlgeschlagen: ' + e.message); }
  }

  // Wire buttons
  btns.ledOn?.addEventListener('click', ()=>setMode('on'));
  btns.ledOff?.addEventListener('click', ()=>setMode('off'));
  btns.ledAuto?.addEventListener('click', ()=>setMode('auto'));
  btns.bachOn?.addEventListener('click', ()=>setBach('on'));
  btns.bachOff?.addEventListener('click', ()=>setBach('off'));
  btns.bachAuto?.addEventListener('click', ()=>setBach('auto'));

  // initial load
  fetchMode();
  fetchBach();

  // poll every 5s to keep UI in sync
  setInterval(()=>{ fetchMode(); fetchBach(); }, 5000);
});
