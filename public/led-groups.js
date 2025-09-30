// led-groups.js — individuelle Quadrate
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function makeItem(idx, hex) {
  const item = document.createElement('div');
  item.className = 'led-color-item';
  item.innerHTML = `
    <span class="led-label">#${idx+1}</span>
    <div class="color-square" data-idx="${idx}" style="background:${hex||'#RRGGBB'}">
      <input type="color" value="${/^#([0-9a-f]{6})$/i.test(hex||'')?hex:'#ffffff'}" aria-label="Farbe LED ${idx+1}">
    </div>
    <input class="color-hex" type="text" value="${hex||''}" placeholder="#RRGGBB">
  `;
  const picker = item.querySelector('input[type=color]');
  picker.addEventListener('input', () => {
    const c = picker.value;
    item.querySelector('.color-square').style.background = c;
    item.querySelector('.color-hex').value = c;
  });
  return item;
}

async function loadSaved() {
  const res = await fetch('/api/led-groups').then(r=>r.json()).catch(()=>({ok:false}));
  if (!res.ok) return;
  const data = res.data || [];
  const saved = $('#saved-leds');
  if (!data.length) { saved.innerHTML = ''; return; }
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>#</th><th>Farbe</th></tr></thead><tbody></tbody>';
  const tb = table.querySelector('tbody');
  data.forEach((h,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td><div style="width:24px;height:24px;border:1px solid var(--border);border-radius:6px;background:${h||'transparent'}"></div></td>`;
    tb.appendChild(tr);
  });
  saved.innerHTML = '<h3>Gespeicherte Farben</h3>';
  saved.appendChild(table);
}

function buildPalette() {
  const count = Math.max(1, parseInt($('#led-count').value || '1', 10));
  const host = $('#palette');
  host.innerHTML = '';
  for (let i = 0; i < count; i++) host.appendChild(makeItem(i));
}

async function saveLeds() {
  const hexes = $$('.color-hex').map(inp => inp.value && /^#([0-9a-f]{6})$/i.test(inp.value) ? inp.value : null);
  const res = await fetch('/api/led-groups', {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: hexes })
  }).then(r=>r.json()).catch(e=>({ok:false,error:String(e)}));
  const log = $('#log-output');
  log.textContent = res.ok ? '✅ Gespeichert.' : ('❌ Fehler: ' + (res.error||'unbekannt'));
  await loadSaved();
}

$('#build-palette').addEventListener('click', buildPalette);
$('#save-leds').addEventListener('click', saveLeds);
document.addEventListener('DOMContentLoaded', () => { buildPalette(); loadSaved(); });
