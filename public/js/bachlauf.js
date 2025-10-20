// public/js/bachlauf.js
// Minimal client to control the pump via /api/bachlauf
async function api(path, method='GET', body=null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('/api/bachlauf' + path, opts);
  return res.json();
}

async function refreshStatus() {
  try {
    const s = await api('/status');
    document.getElementById('status-bachlauf-value').textContent = s.pumpState || '-';
    document.getElementById('bachlauf-source').textContent = s.manualOverride ? 'manual' : 'auto';
    document.getElementById('bachlauf-manual').textContent = s.manualOverride || '-';
  } catch (e) {
    console.warn('bachlauf status error', e);
  }
}

async function doManual(action) {
  try {
    await api('/manual', 'POST', { action });
    await refreshStatus();
  } catch (e) { console.warn('manual error', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  const onBtn = document.getElementById('bachlauf-on');
  const offBtn = document.getElementById('bachlauf-off');
  const clearBtn = document.getElementById('bachlauf-clear');
  if (onBtn) onBtn.addEventListener('click', () => doManual('on'));
  if (offBtn) offBtn.addEventListener('click', () => doManual('off'));
  if (clearBtn) clearBtn.addEventListener('click', () => doManual('clear'));
  setInterval(refreshStatus, 2000);
  refreshStatus();
});
