async function load(){
  const res = await fetch('/api/groups'); const rows = await res.json();
  const tbody = document.querySelector('#tbl tbody'); tbody.innerHTML='';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input value="${r.name}" data-k="name"/></td>
      <td><input type="number" value="${r.start_index}" data-k="start_index"/></td>
      <td><input type="number" value="${r.length}" data-k="length"/></td>
      <td><input type="color" value="${r.color}" data-k="color"/></td>
      <td><button data-id="${r.id}" class="save">Speichern</button>
          <button data-id="${r.id}" class="del">Löschen</button>
          <button data-name="${r.name}" data-color="${r.color}" class="test">Test</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('.save').onclick = async (ev)=>{
      const t = ev.target.closest('tr'); const body = {};
      t.querySelectorAll('input').forEach(inp=> body[inp.dataset.k] = inp.type==='number'? Number(inp.value): inp.value);
      await fetch('/api/groups/'+ev.target.dataset.id,{method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); await load();
    };
    tr.querySelector('.del').onclick = async (ev)=>{ await fetch('/api/groups/'+ev.target.dataset.id,{method:'DELETE'}); await load(); };
    tr.querySelector('.test').onclick = async (ev)=>{
      await fetch('/api/led/group',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: ev.target.dataset.name, color: ev.target.dataset.color })});
    };
  }
}
document.getElementById('add').onclick = async ()=>{
  const body = { name: n_name.value, start_index: Number(n_start.value), length: Number(n_len.value), color: n_color.value };
  await fetch('/api/groups',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); await load();
};
load();
