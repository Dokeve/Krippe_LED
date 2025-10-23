// Globaler State (kann bei Bedarf durch Backend-Werte ersetzt werden)
window.AppConfig = {
  backgroundImagePath: "" // Leer = kein Bild; sonst absolute/relative URL
};

// Hintergrund anwenden
(function applyBackground(){
  if(AppConfig.backgroundImagePath && AppConfig.backgroundImagePath.trim()!==""){
    document.body.style.backgroundImage = `url('${AppConfig.backgroundImagePath}')`;
    document.body.classList.add("has-bg");
  }else{
    document.body.style.backgroundImage = "";
    document.body.classList.remove("has-bg");
  }
})();

// Alerts
function toast(msg){ alert(msg); }

// Robust parse JSON
async function safeJson(res){
  try{ return await res.json(); }catch(_){ return null; }
}

// Frontend Validation Helpers
function requireNumber(v, min=null, max=null){
  const n = Number(v);
  if(Number.isNaN(n)) return {ok:false, msg:"Wert ist keine Zahl"};
  if(min!==null && n<min) return {ok:false, msg:`Wert < ${min}`};
  if(max!==null && n>max) return {ok:false, msg:`Wert > ${max}`};
  return {ok:true, value:n};
}
