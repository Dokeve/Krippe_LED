// global helpers
window.AppConfig = { backgroundImagePath: "" };

(function applyBackground(){
  if(AppConfig.backgroundImagePath && AppConfig.backgroundImagePath.trim()!==""){
    document.body.style.backgroundImage = `url('${AppConfig.backgroundImagePath}')`;
    document.body.classList.add("has-bg");
  }else{
    document.body.style.backgroundImage = "";
    document.body.classList.remove("has-bg");
  }
})();

function toast(msg){ alert(msg); }
async function safeJson(res){ try{ return await res.json(); }catch(e){ return null; } }
function requireNumber(v, min=null, max=null){ const n = Number(v); if(Number.isNaN(n)) return {ok:false,msg:"Nicht numerisch"}; if(min!==null && n<min) return {ok:false,msg:"Zu klein"}; if(max!==null && n>max) return {ok:false,msg:"Zu groß"}; return {ok:true,value:n}; }
