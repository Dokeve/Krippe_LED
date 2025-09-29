const ioClient = io(); const logs=document.getElementById('logs');
function addLog({level,msg,ts}){ const d=ts?new Date(ts).toLocaleString():new Date().toLocaleString(); const line=document.createElement('div'); line.textContent=`[${d}] [${level}] ${msg}`; logs.appendChild(line); logs.scrollTop=logs.scrollHeight; }
ioClient.on('log', addLog);
document.getElementById('play').onclick = async ()=>{
  const file = document.getElementById('file').value;
  const res = await fetch('/api/audio/play',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file })});
  const j = await res.json(); addLog({level:j.ok?'success':'error', msg:j.ok?('Spiele: '+j.playing):j.error});
};
document.getElementById('stop').onclick = async ()=>{ await fetch('/api/audio/stop',{method:'POST'}); addLog({level:'info', msg:'Audio gestoppt.'}); };
