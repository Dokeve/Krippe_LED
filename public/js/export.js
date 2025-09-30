// public/js/export.js
// Letzte Änderung: 02.09.2025 13:45 Uhr
// Ergänzt um Import/Upload: calendar.json, audio.json, led-groups.json
document.addEventListener('DOMContentLoaded', () => {
  /* -------- Export -------- */
  const btnExport = document.getElementById('export-all');
  const links = document.getElementById('export-links');
  const pageLog = document.getElementById('log-output');

  const log = (m) => {
    console.log(m);
    if (!pageLog) return;
    pageLog.textContent = (pageLog.textContent ? pageLog.textContent + "\n" : "") + m;
  };

  btnExport?.addEventListener('click', async () => {
    try {
      const [cal, audio, led] = await Promise.all([
        fetch('/api/calendar', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/audio', { cache: 'no-store' }).then(r=>r.json()),
        fetch('/api/led-groups', { cache: 'no-store' }).then(r=>r.json())
      ]);
      const files = [
        { name:'calendar.json', data:cal },
        { name:'audio.json', data:audio },
        { name:'led-groups.json', data:led }
      ];
      links.innerHTML = '';
      files.forEach(f => {
        const blob = new Blob([JSON.stringify(f.data, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = f.name; a.textContent = 'Download ' + f.name;
        const wrap = document.createElement('div'); wrap.appendChild(a);
        links.appendChild(wrap);
      });
      log('[OK] Export erstellt');
    } catch (e) {
      log('❌ Export fehlgeschlagen: ' + e.message);
    }
  });

  /* -------- Import / Upload -------- */
  const inputFiles = document.getElementById('import-files');
  const btnImportApply = document.getElementById('import-apply');
  const importLog = document.getElementById('import-log');

  const ilog = (m) => {
    console.log('[IMPORT]', m);
    if (!importLog) return;
    importLog.textContent = (importLog.textContent ? importLog.textContent + "\n" : "") + m;
  };

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('FileReader error'));
      fr.readAsText(file, 'utf-8');
    });
  }

  async function putJson(url, data) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  }

  function detectTarget(fileName) {
    const n = (fileName || '').toLowerCase();
    if (n === 'calendar.json') return { endpoint: '/api/calendar', type: 'calendar' };
    if (n === 'audio.json') return { endpoint: '/api/audio', type: 'audio' };
    if (n === 'led-groups.json' || n === 'led-groups.json'.replace('-', '_')) return { endpoint: '/api/led-groups', type: 'led' };
    // Heuristik (falls jemand anders benannt hat)
    if (n.includes('calendar')) return { endpoint: '/api/calendar', type: 'calendar' };
    if (n.includes('audio')) return { endpoint: '/api/audio', type: 'audio' };
    if (n.includes('led') && n.includes('group')) return { endpoint: '/api/led-groups', type: 'led' };
    return null;
  }

  function validateShape(type, json) {
    try {
      if (type === 'calendar') {
        if (!Array.isArray(json)) throw new Error('Erwarte Array für calendar.json');
        // Soft-Check: Elemente optional prüfen
        return true;
      }
      if (type === 'audio') {
        if (typeof json !== 'object' || json === null) throw new Error('Erwarte Objekt für audio.json');
        return true;
      }
      if (type === 'led') {
        if (typeof json !== 'object' || json === null) throw new Error('Erwarte Objekt für led-groups.json');
        return true;
      }
      throw new Error('Unbekannter Typ');
    } catch (e) {
      throw e;
    }
  }

  btnImportApply?.addEventListener('click', async () => {
    try {
      ilog('Starte Import…');
      if (!inputFiles?.files || inputFiles.files.length === 0) {
        throw new Error('Keine Dateien ausgewählt.');
      }

      // Dateien lesen
      const files = Array.from(inputFiles.files);
      // Reihenfolge egal; wir loggen je Datei
      for (const f of files) {
        const target = detectTarget(f.name);
        if (!target) {
          ilog(`⚠ Datei übersprungen (unbekannt): ${f.name}`);
          continue;
        }
        ilog(`Lese ${f.name} → Ziel: ${target.endpoint}`);
        const text = await readFileAsText(f);

        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          ilog(`❌ JSON-Parse-Fehler in ${f.name}: ${e.message}`);
          continue;
        }

        try {
          validateShape(target.type, json);
        } catch (e) {
          ilog(`❌ Schema-Fehler in ${f.name}: ${e.message}`);
          continue;
        }

        // Senden
        try {
          const res = await putJson(target.endpoint, json);
          ilog(`[OK] ${f.name} importiert (${target.type}); Server: ${JSON.stringify(res)}`);
        } catch (e) {
          ilog(`❌ Upload fehlgeschlagen für ${f.name}: ${e.message}`);
        }
      }

      ilog('Import abgeschlossen.');
    } catch (e) {
      ilog('❌ Import abgebrochen: ' + e.message);
    }
  });

  // Convenience: bei neuer Dateiauswahl Status zurücksetzen
  inputFiles?.addEventListener('change', () => {
    if (importLog) importLog.textContent = 'Dateien gewählt. Bereit zum Import.';
  });
});
