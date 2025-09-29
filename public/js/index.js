const ioClient = io();
const logs = document.getElementById('logs');
function addLog({level,msg,ts}){
  const line = document.createElement('div');
  const d = ts? new Date(ts).toLocaleString(): new Date().toLocaleString();
  line.textContent = `[${d}] [${level}] ${msg}`;
  logs.appendChild(line); logs.scrollTop = logs.scrollHeight;
}
ioClient.on('log', addLog);
ioClient.on('schedule', p => addLog({level:'info', msg:'Scheduler: Modul '+p.activeModule, ts: p.ts*1000}));
document.getElementById('btnOn').onclick = async ()=>{
  const color = document.getElementById('color').value;
  await fetch('/api/led/on',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ color })});
};
document.getElementById('btnOff').onclick = async ()=>{ await fetch('/api/led/off',{method:'POST'}); };
document.getElementById('flowOn').onclick = ()=> fetch('/api/flow',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ on:true })});
document.getElementById('flowOff').onclick = ()=> fetch('/api/flow',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ on:false })});
document.querySelectorAll('[data-module]').forEach(btn=>{
  btn.onclick = ()=> fetch('/api/module',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ module: Number(btn.dataset.module) })});
});
