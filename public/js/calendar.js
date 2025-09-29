function tsLocalToEpoch(el){ return Math.floor(new Date(el.value).getTime()/1000); }
function epochToLocal(ts){ const d=new Date(ts*1000); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
async function load(){
  const rows = await (await fetch('/api/calendar')).json();
  const tbody = document.querySelector('#tbl tbody'); tbody.innerHTML='';
  for (const r of rows){
    const tr = document.createElement('tr');
    tr.innerHTML=`<td><input value="${r.title}" data-k="title"/></td>
      <td><input type="datetime-local" value="${epochToLocal(r.start_ts)}" data-k="start_ts"/></td>
      <td><input type="datetime-local" value="${epochToLocal(r.end_ts)}" data-k="end_ts"/></td>
      <td><select data-k="module"><option value="1" ${r.module===1?'selected':''}>Modul 1</option><option value="2" ${r.module===2?'selected':''}>Modul 2</option></select></td>
      <td><button data-id="${r.id}" class="save">Speichern</button><button data-id="${r.id}" class="del">Löschen</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('.save').onclick = async (ev)=>{
      const t = ev.target.closest('tr'); const body = {};
      t.querySelectorAll('input,select').forEach(inp=>{
        const k=inp.dataset.k;
        body[k]=(inp.type==='datetime-local')? Math.floor(new Date(inp.value).getTime()/1000) : (inp.tagName==='SELECT'? Number(inp.value): inp.value);
      });
      await fetch('/api/calendar/'+ev.target.dataset.id,{method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); await load();
    };
    tr.querySelector('.del').onclick = async (ev)=>{ await fetch('/api/calendar/'+ev.target.dataset.id,{method:'DELETE'}); await load(); };
  }
}
add.onclick = async ()=>{
  const body = { title: n_title.value, start_ts: tsLocalToEpoch(n_start), end_ts: tsLocalToEpoch(n_end), module: Number(n_module.value) };
  await fetch('/api/calendar',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); await load();
};
load();
