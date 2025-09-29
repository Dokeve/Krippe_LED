import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';
import AdmZip from 'adm-zip';
import config from '../config.js';
import { getDB } from '../services/db.js';
import * as LED from '../services/ws2812.js';
import * as GPIO from '../services/gpio.js';
import * as Scn from '../services/scenarios.js';
import { Log } from '../services/log.js';
import playsoundPkg from 'play-sound';
import { execSync } from 'child_process';

const router = Router();

router.get('/status', (req,res)=>{
  res.json({ ok: true, time: Date.now() });
});

router.post('/led/on', async (req,res)=>{
  const { color = '#ffffff' } = req.body || {};
  try {
    LED.setAll(color);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});
router.post('/led/off', (req,res)=>{
  try {
    LED.off();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});
router.post('/led/group', (req,res)=>{
  const { name, color } = req.body || {};
  if (!name || !color) return res.status(400).json({ ok:false, error:'name & color nötig' });
  try {
    LED.setGroup(name, color);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.post('/flow', (req,res)=>{
  const { on } = req.body || {};
  try {
    if (on) GPIO.flowOn(); else GPIO.flowOff();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.post('/module', async (req,res)=>{
  const { module } = req.body || {};
  if (![1,2].includes(Number(module))) return res.status(400).json({ ok:false, error:'module 1 oder 2' });
  try {
    await Scn.applyModule(Number(module));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.get('/groups', (req,res)=>{
  const db = getDB();
  const rows = db.prepare('SELECT * FROM led_groups ORDER BY start_index').all();
  res.json(rows);
});
router.post('/groups', (req,res)=>{
  const { name, start_index, length, color = '#ffffff' } = req.body || {};
  const db = getDB();
  try {
    const stmt = db.prepare('INSERT INTO led_groups (name,start_index,length,color) VALUES (?,?,?,?)');
    const info = stmt.run(name, Number(start_index), Number(length), color);
    res.json({ ok:true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ ok:false, error: e.message });
  }
});
router.put('/groups/:id', (req,res)=>{
  const { name, start_index, length, color } = req.body || {};
  const db = getDB();
  try {
    db.prepare('UPDATE led_groups SET name=?, start_index=?, length=?, color=? WHERE id=?')
      .run(name, Number(start_index), Number(length), color, Number(req.params.id));
    res.json({ ok:true });
  } catch (e) {
    res.status(400).json({ ok:false, error: e.message });
  }
});
router.delete('/groups/:id', (req,res)=>{
  const db = getDB();
  db.prepare('DELETE FROM led_groups WHERE id=?').run(Number(req.params.id));
  res.json({ ok:true });
});

router.get('/calendar', (req,res)=>{
  const db = getDB();
  const rows = db.prepare('SELECT * FROM calendar ORDER BY start_ts').all();
  res.json(rows);
});
router.post('/calendar', (req,res)=>{
  const { title, start_ts, end_ts, module } = req.body || {};
  const db = getDB();
  const created_at = Math.floor(Date.now()/1000);
  const stmt = db.prepare('INSERT INTO calendar (title,start_ts,end_ts,module,created_at) VALUES (?,?,?,?,?)');
  const info = stmt.run(title, Number(start_ts), Number(end_ts), Number(module), created_at);
  res.json({ ok:true, id: info.lastInsertRowid });
});
router.put('/calendar/:id', (req,res)=>{
  const { title, start_ts, end_ts, module } = req.body || {};
  const db = getDB();
  db.prepare('UPDATE calendar SET title=?, start_ts=?, end_ts=?, module=? WHERE id=?')
    .run(title, Number(start_ts), Number(end_ts), Number(module), Number(req.params.id));
  res.json({ ok:true });
});
router.delete('/calendar/:id', (req,res)=>{
  const db = getDB();
  db.prepare('DELETE FROM calendar WHERE id=?').run(Number(req.params.id));
  res.json({ ok:true });
});

router.post('/audio/play', async (req,res)=>{
  const { file } = req.body || {};
  try {
    const player = playsoundPkg({});
    const full = path.join(process.cwd(), config.audio.dir, path.basename(file || ''));
    if (!fs.existsSync(full)) return res.status(404).json({ ok:false, error:'Datei nicht gefunden' });
    player.play(full, (err)=>{
      if (err) Log.error('Audio Fehler: '+err.message);
    });
    res.json({ ok:true, playing: path.basename(full) });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});
router.post('/audio/stop', async (req,res)=>{
  try {
    execSync(['pkill -f aplay || true',
              'pkill -f mpg123 || true',
              'pkill -f vlc || true',
              'pkill -f ffplay || true',
              'pkill -f paplay || true'].join('; '));
    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

router.get('/export', (req,res)=>{
  const db = getDB();
  const groups = db.prepare('SELECT * FROM led_groups ORDER BY start_index').all();
  const cal = db.prepare('SELECT * FROM calendar ORDER BY start_ts').all();
  res.json({ groups, calendar: cal });
});

router.post('/update', (req,res)=>{
  if (config.security.updateToken && req.headers['x-update-token'] !== config.security.updateToken) {
    return res.status(401).json({ ok:false, error:'Unauthorized' });
  }
  const bb = Busboy({ headers: req.headers, limits: { files: 1 } });
  let zipPath = null;
  bb.on('file', (name, file, info)=>{
    const tmp = path.join('data', 'upload_'+Date.now()+'.zip');
    zipPath = tmp;
    const ws = fs.createWriteStream(tmp);
    file.pipe(ws);
  });
  bb.on('close', ()=>{
    if (!zipPath) return res.status(400).json({ ok:false, error:'Keine ZIP' });
    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      for (const e of entries) {
        const p = e.entryName;
        if (p.startsWith('data/')) continue;
        const dest = path.join(process.cwd(), p);
        if (e.isDirectory) {
          fs.mkdirSync(dest, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, e.getData());
        }
      }
      res.json({ ok:true, message:'Update entpackt. Bitte Dienst neu starten.' });
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    } finally {
      try { fs.unlinkSync(zipPath); } catch {}
    }
  });
  req.pipe(bb);
});

export default router;
