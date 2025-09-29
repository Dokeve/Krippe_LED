document.getElementById('upload').onclick = async ()=>{
  const f = document.getElementById('zipfile').files[0];
  if (!f) { alert('ZIP auswählen'); return; }
  const fd = new FormData(); fd.append('file', f, f.name);
  const res = await fetch('/api/update', { method:'POST', body: fd });
  const j = await res.json(); document.getElementById('msg').textContent = j.ok? j.message : ('Fehler: '+j.error);
};
