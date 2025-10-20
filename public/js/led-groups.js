// public/js/led-groups.js
// Stand wiederhergestellt + Fixes: 02.09.2025 08:00 Uhr
document.addEventListener("DOMContentLoaded", () => {
  const logOutput = document.getElementById("log-output");
  const log = (m) => { console.log(m); if (logOutput) logOutput.textContent += m + "\n"; };

  const subgroupTemplate = document.getElementById("subgroup-template");

  /* ------------ Utilities ------------ */
  function parseLedSelection(text) {
    const set = new Set();
    (text||"").split(',').map(s=>s.trim()).filter(Boolean).forEach(part=>{
      if (part.includes('-')) {
        const [a,b] = part.split('-').map(x=>parseInt(x,10));
        if (!isNaN(a)&&!isNaN(b)) for (let i=Math.min(a,b); i<=Math.max(a,b); i++) set.add(i);
      } else {
        const n = parseInt(part,10); if (!isNaN(n)) set.add(n);
      }
    });
    return Array.from(set).sort((a,b)=>a-b);
  }
  const isHex = v => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((v||'').trim());

  function updateToggleButton(button, expanded) {
    if (!button) return;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.textContent = expanded ? 'Bereich einklappen' : 'Bereich anzeigen';
  }

  function toggleGroupArea(button, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const collapsed = target.classList.toggle('collapsed');
    updateToggleButton(button, !collapsed);
  }

  function getTransitionInputs(kind) {
    return Array.from(document.querySelectorAll(`[data-transition="${kind}"] input[type="color"]`));
  }

  function setTransitionPalette(kind, colors) {
    const inputs = getTransitionInputs(kind);
    inputs.forEach((input, index) => {
      const pick = Array.isArray(colors) ? colors[index] : null;
      if (pick && isHex(pick)) {
        input.value = pick.toUpperCase();
      }
    });
  }

  function readTransitionPalette(kind) {
    return getTransitionInputs(kind).map((input) => {
      const value = (input?.value || '').toUpperCase();
      return isHex(value) ? value : '';
    });
  }

  /* ------------ Szenario-UI ------------ */
  function scenarioRowTemplate() {
    const row = document.createElement('div');
    row.className = 'scenario-row';
    row.innerHTML = `
      <select class="scenario-select">
        <option value="">-- wählen --</option>
        <option value="Tag">Tag</option>
        <option value="Tag-Nacht">Tag-Nacht</option>
        <option value="Nacht">Nacht</option>
        <option value="Nacht-Tag">Nacht-Tag</option>
      </select>
      <input type="number" class="scenario-start" placeholder="Start (s)" min="0" />
      <input type="number" class="scenario-end" placeholder="Ende (s)" min="0" />
      <input type="text" class="led-selection" placeholder="LEDs (z. B. 1-5,10,13-15)" />
      <button type="button" class="delete-scenario">🗑</button>
    `;
    row.querySelector(".delete-scenario")?.addEventListener("click", () => row.remove());
    return row;
  }
  function addScenarioRow(subgroupEl) {
    subgroupEl.querySelector(".scenarios-list")?.appendChild(scenarioRowTemplate());
  }

  /* ------------ Individuelle Farben (nur Quadrate) ------------ */
  function makeColorSquare(initHex, onChange) {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.className = 'color-square';
    inp.value = isHex(initHex) ? initHex.toUpperCase() : '#000000';
    inp.addEventListener('input', () => onChange?.(inp.value.toUpperCase()));
    return inp;
  }
  function renderIndividualPalette(subRoot, ledCount, savedArr) {
    const host = subRoot.querySelector('.led-color-palette');
    if (!host) return;
    host.innerHTML = '';
    const count = Math.max(0, parseInt(ledCount||0,10));
    for (let i=1; i<=count; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'led-color-item';
      const label = document.createElement('span');
      label.className = 'led-label';
      label.textContent = `#${i}`;

      const hex = Array.isArray(savedArr) ? savedArr[i-1] : '';
      const picker = makeColorSquare(hex, (val)=> { wrap.dataset.hex = val; });
      wrap.dataset.hex = isHex(hex) ? hex.toUpperCase() : '';

      wrap.appendChild(label);
      wrap.appendChild(picker);
      host.appendChild(wrap);
    }
  }
  function readIndividualPalette(subRoot) {
    const host = subRoot.querySelector('.led-color-palette');
    if (!host) return [];
    return Array.from(host.querySelectorAll('.led-color-item')).map(it => {
      const v = it.dataset.hex || '';
      return isHex(v) ? v.toUpperCase() : '';
    });
  }
  function renderSavedColorsTable(subRoot, arr) {
    const tbody = subRoot.querySelector('table.saved-colors tbody');
    if (!tbody) return;
    if (!Array.isArray(arr) || arr.length === 0) { tbody.innerHTML = ''; return; }
    tbody.innerHTML = arr.map((hex,i)=>{
      const h = isHex(hex) ? hex.toUpperCase() : '';
      const chip = h ? `<span style="display:inline-block;width:16px;height:16px;border:1px solid var(--border);border-radius:3px;background:${h};"></span>` : '';
      return `<tr><td>${i+1}</td><td>${chip}</td><td>${h}</td></tr>`;
    }).join('');
  }

  /* ------------ Subgroup (Erstellen/Lesen) ------------ */
  function createSubgroupElement(data) {
    if (!subgroupTemplate) { log('❌ Template fehlt'); return document.createElement('div'); }
    const frag = subgroupTemplate.content.cloneNode(true);
    const el = frag.querySelector('.subgroup');

    const q = (sel) => el.querySelector(sel);
    q('.sub-name').value = data?.name || '';
    q('.sub-led-from').value = data?.ledFrom ?? '';
    q('.sub-led-to').value = data?.ledTo ?? '';
    q('.sub-led-count').value = data?.ledCount ?? '';
    q('.sub-wall').checked = !!data?.wall;
    q('.sub-always').checked = !!data?.alwaysOn;
    q('.sub-color-day').value = isHex(data?.colorDay) ? data.colorDay : '#000000';
    q('.sub-color-night').value = isHex(data?.colorNight) ? data.colorNight : '#000000';

    const list = q('.scenarios-list');
    (data?.scenarios || []).forEach(s => {
      const row = scenarioRowTemplate();
      row.querySelector('.scenario-select').value = s.name || '';
      row.querySelector('.scenario-start').value = s.start ?? '';
      row.querySelector('.scenario-end').value = s.end ?? '';
      row.querySelector('.led-selection').value = Array.isArray(s.leds) ? s.leds.join(',') : (s.leds||'');
      list?.appendChild(row);
    });

    // individuelle Farben (Quadrate)
    renderIndividualPalette(el, data?.ledCount || 0, data?.individualColors || []);
    renderSavedColorsTable(el, data?.individualColors || []);

    // Events – defensiv mit Optional Chaining
    q('.toggle-details')?.addEventListener('click', () => {
      const d = q('.sub-details'); if (d) d.open = !d.open;
    });
    q('.add-scenario-row')?.addEventListener('click', () => addScenarioRow(el));
    q('.gen-individual-colors')?.addEventListener('click', () => {
      const count = parseInt(q('.sub-led-count')?.value || 0, 10);
      renderIndividualPalette(el, count, []);
    });
    q('.save-subgroup')?.addEventListener('click', async () => {
      await saveAll();
      const arr = readIndividualPalette(el);
      renderSavedColorsTable(el, arr);
    });
    q('.delete-subgroup')?.addEventListener('click', () => { el.remove(); log('Untergruppe gelöscht'); });

    return el;
  }

  function readSubgroupElement(el) {
    const get = (sel) => el.querySelector(sel);
    const data = {
      name: get(".sub-name")?.value || '',
      ledFrom: parseInt(get(".sub-led-from")?.value || 0, 10),
      ledTo: parseInt(get(".sub-led-to")?.value || 0, 10),
      ledCount: parseInt(get(".sub-led-count")?.value || 0, 10),
      wall: !!get(".sub-wall")?.checked,
      alwaysOn: !!get(".sub-always")?.checked,
      colorDay: get(".sub-color-day")?.value || '#000000',
      colorNight: get(".sub-color-night")?.value || '#000000',
      scenarios: [],
      individualColors: readIndividualPalette(el)
    };
    el.querySelectorAll(".scenario-row").forEach(row => {
      const scenario = {
        name: row.querySelector(".scenario-select")?.value || '',
        start: parseInt(row.querySelector(".scenario-start")?.value || 0, 10),
        end: parseInt(row.querySelector(".scenario-end")?.value || 0, 10),
        leds: parseLedSelection(row.querySelector(".led-selection")?.value || '')
      };
      if (scenario.name) data.scenarios.push(scenario);
    });
    return data;
  }

  function addSubgroup(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const el = createSubgroupElement(data);
    container.appendChild(el);
  }

  function readGroupUI(rootEl) {
    const groups = [];
    rootEl?.querySelectorAll(".subgroup")?.forEach(sub => groups.push(readSubgroupElement(sub)));
    return groups;
  }

  /* ------------ Lagerfeuer ------------ */
  function readLagerfeuerUI() {
    const sc = [];
    document.querySelectorAll("#lagerfeuer-scenarios .scenario-row").forEach(row=>{
      sc.push({
        name: row.querySelector(".scenario-select")?.value||'',
        start: parseInt(row.querySelector(".scenario-start")?.value||0,10),
        end: parseInt(row.querySelector(".scenario-end")?.value||0,10),
      });
    });
    return {
      ledFrom: parseInt(document.getElementById("lagerfeuer-led-from")?.value||0,10),
      ledTo: parseInt(document.getElementById("lagerfeuer-led-to")?.value||0,10),
      ledCount: parseInt(document.getElementById("lagerfeuer-led-count")?.value||0,10),
      colors: [
        document.getElementById("lagerfeuer-color1")?.value,
        document.getElementById("lagerfeuer-color2")?.value,
        document.getElementById("lagerfeuer-color3")?.value,
        document.getElementById("lagerfeuer-color4")?.value,
        document.getElementById("lagerfeuer-color5")?.value
      ],
      useValueNoise: !!document.getElementById("lagerfeuer-use-value-noise")?.checked,
      speedMultiplier: Number.parseFloat(document.getElementById("lagerfeuer-speed-multiplier")?.value) || 10,
      scenarios: sc
    };
  }

  /* ------------ Persistenz ------------ */
  async function saveAll() {
    const payload = {
      adventActive: document.getElementById("group-advent-active")?.checked || false,
      weihnachtActive: document.getElementById("group-weihnacht-active")?.checked || false,
      advent: readGroupUI(document.getElementById("advent-subgroups")),
      weihnacht: readGroupUI(document.getElementById("weihnacht-subgroups")),
      lagerfeuer: readLagerfeuerUI(),
      transitions: {
        dayNight: readTransitionPalette('day-night'),
        nightDay: readTransitionPalette('night-day')
      }
    };
    try {
      await fetch('/api/led-groups', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      log('LED-Gruppen gespeichert');
    } catch(e) { log('❌ Speichern fehlgeschlagen: ' + e.message); }
  }

  async function loadAll() {
    try {
      const cfg = await fetch('/api/led-groups').then(r=>r.json());

      document.getElementById("group-advent-active").checked = !!cfg.adventActive;
      document.getElementById("group-weihnacht-active").checked = !!cfg.weihnachtActive;

      const adv = document.getElementById("advent-subgroups"); adv.innerHTML = '';
      const wei = document.getElementById("weihnacht-subgroups"); wei.innerHTML = '';

      (cfg.advent||[]).forEach(sg => addSubgroup("advent-subgroups", sg));
      (cfg.weihnacht||[]).forEach(sg => addSubgroup("weihnacht-subgroups", sg));

      const l = cfg.lagerfeuer || {};
      document.getElementById("lagerfeuer-led-from").value = l.ledFrom ?? 0;
      document.getElementById("lagerfeuer-led-to").value = l.ledTo ?? 0;
      document.getElementById("lagerfeuer-led-count").value = l.ledCount ?? 0;
      const cols = l.colors || [];
      ['#lagerfeuer-color1','#lagerfeuer-color2','#lagerfeuer-color3','#lagerfeuer-color4','#lagerfeuer-color5']
        .forEach((sel, i) => { const el = document.querySelector(sel); if (el) el.value = cols[i] || el.value; });
      // load new options (useValueNoise, speedMultiplier)
      document.getElementById("lagerfeuer-use-value-noise").checked = !!l.useValueNoise;
      document.getElementById("lagerfeuer-speed-multiplier").value = Number.isFinite(Number(l.speedMultiplier)) ? Number(l.speedMultiplier) : 10;

      // Render lagerfeuer scenarios into the UI so they can be edited and saved again
      const lfHost = document.getElementById('lagerfeuer-scenarios');
      if (lfHost) {
        lfHost.innerHTML = '';
        (l.scenarios || []).forEach(s => {
          const row = scenarioRowTemplate();
          row.querySelector('.scenario-select').value = s.name || '';
          row.querySelector('.scenario-start').value = s.start ?? '';
          row.querySelector('.scenario-end').value = s.end ?? '';
          // remove led-selection for lagerfeuer rows (not needed)
          const ledSel = row.querySelector('.led-selection'); if (ledSel) ledSel.remove();
          lfHost.appendChild(row);
        });
      }

      const transitions = cfg.transitions || {};
      setTransitionPalette('day-night', transitions.dayNight);
      setTransitionPalette('night-day', transitions.nightDay);

      log('[OK] LED-Gruppen geladen');
    } catch(e) {
      log('❌ Laden fehlgeschlagen: ' + e.message);
    }
  }

  /* ------------ Buttons ------------ */
  document.getElementById("add-advent-subgroup")?.addEventListener("click", () => addSubgroup("advent-subgroups"));
  document.getElementById("add-weihnacht-subgroup")?.addEventListener("click", () => addSubgroup("weihnacht-subgroups"));
  document.getElementById("save-advent-group")?.addEventListener("click", saveAll);
  document.getElementById("save-weihnacht-group")?.addEventListener("click", saveAll);
  document.getElementById("add-lagerfeuer-scenario")?.addEventListener("click", () => {
    const host = document.getElementById("lagerfeuer-scenarios");
    if (!host) return;
    const row = scenarioRowTemplate();
    // Lagerfeuer braucht keine LED-Liste
    const ledSel = row.querySelector('.led-selection'); if (ledSel) ledSel.remove();
    host.appendChild(row);
  });
  document.getElementById("save-lagerfeuer")?.addEventListener("click", saveAll);
  document.getElementById("test-lagerfeuer")?.addEventListener("click", () => log("Lagerfeuer Simulation gestartet"));
  document.getElementById("save-transition-palettes")?.addEventListener("click", saveAll);

  document.querySelectorAll(".toggle-group").forEach((button) => {
    const targetId = button.dataset.target;
    if (!targetId) return;
    // Start collapsed by default on first load
    const target = document.getElementById(targetId);
    if (target && !target.classList.contains('collapsed')) {
      target.classList.add('collapsed');
    }
    updateToggleButton(button, false);
    button.addEventListener("click", () => toggleGroupArea(button, targetId));
  });

  /* ------------ Init ------------ */
  loadAll();
});
