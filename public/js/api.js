async function apiGet(path){
  const r = await fetch(`/api/${path}`);
  if(!r.ok) throw new Error(`GET /api/${path} => ${r.status}`);
  return await r.json();
}
async function apiPost(path,data){
  const r = await fetch(`/api/${path}`,{
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data||{})
  });
  const j = await safeJson(r);
  if(!r.ok) throw new Error(j?.error || `POST /api/${path} => ${r.status}`);
  return j;
}
