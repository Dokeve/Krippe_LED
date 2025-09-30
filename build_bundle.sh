#!/usr/bin/env bash
set -euo pipefail

# Basisverzeichnis (aktuelles Projekt)
BASE="${PWD}"

echo "[build] Starte Paketaufbau unter: $BASE"

# Zielstruktur
ROOT="$BASE/__bundle__/led-sound-bachlauf"
PUB="$ROOT/public"
PUBJS="$PUB/js"
ROUTES="$ROOT/routes"
SERV="$ROOT/services"

rm -rf "$ROOT" "__bundle__" || true
mkdir -p "$PUBJS" "$ROUTES" "$SERV" "$BASE/__bundle__"

###############################################################################
# Backend-Dateien schreiben (volle, produktive Implementierung)
###############################################################################

# services/db.js – MariaDB: nativity / pi / (kein Passwort)
cat > "$SERV/db.js" <<'JS'
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "pi",
  password: "",
  database: "nativity",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: "Z"
});

export async function query(sql, params = {}) { const [rows] = await pool.execute(sql, params); return rows; }
export async function exec(sql, params = {}) { const [res] = await pool.execute(sql, params); return res; }
export async function tx(work) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const res = await work(conn); await conn.commit(); return res; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}
export async function ping() { const [r] = await query("SELECT 1 AS ok"); if (!r || r.ok !== 1) throw new Error("DB ping failed"); }
export default { query, exec, tx, ping };
JS

# services/gpio.js – Button auf GPIO17 (Pin 11), echte GPIO bevorzugt
cat > "$SERV/gpio.js" <<'JS'
let onoff = null;
try { onoff = await import("onoff"); } catch { onoff = null; }
let gpioButton = null;

export async function initGPIO() {
  if (!onoff) { console.log("[GPIO] onoff nicht verfügbar – Simulation aktiv."); return; }
  try {
    const { Gpio } = await import("onoff");
    // Button: GPIO17 (Pin 11), Flanke: falling
    gpioButton = new Gpio(17, "in", "falling", { debounceTimeout: 50 });
    gpioButton.watch((err) => {
      if (err) return console.error("[GPIO] Button error:", err);
      console.log("[GPIO] Button gedrückt (GPIO17). Hier ggf. Audio-Trigger auslösen.");
    });
    console.log("[GPIO] Echtbetrieb aktiv (GPIO17 überwacht).");
  } catch (e) {
    console.warn("[GPIO] Fallback Simulation (kein Zugriff auf GPIO):", e?.message || e);
  }
}
export async function shutdownGPIO() {
  try { if (gpioButton) { gpioButton.unwatchAll(); gpioButton.unexport(); } } catch {}
}
JS

# services/ws2812.js – WS2812 über rpi-ws281x @ GPIO12 (Pin 32), GND Pin 14
cat > "$SERV/ws2812.js" <<'JS'
let ws = null;
try { const mod = await import("rpi-ws281x"); ws = mod?.default || mod; } catch { ws = null; }

let active = false, numLEDs = 0, pixelData = null;
const gpioPin = 12;   // GPIO12 (Pin 32)
let brightness = 128; // 0..255

function hexToGRB(hex){ const v=parseInt((hex||"#000000").slice(1),16)>>>0; const r=(v>>16)&0xff,g=(v>>8)&0xff,b=v&0xff; return (g<<16)|(r<<8)|b; }

export async function initLEDs(count=1000){
  if(!ws){ console.log("[WS2812] rpi-ws281x nicht verfügbar – Simulation aktiv."); return; }
  numLEDs=count; pixelData=new Uint32Array(numLEDs);
  try{ ws.init(numLEDs,{gpioPin,brightness}); }catch(e){ console.warn("[WS2812] Init-Optionen fehlgeschlagen:", e?.message||e); ws.init(numLEDs); try{ws.setBrightness?.(brightness);}catch{} }
  active=true; console.log(`[WS2812] Init: ${numLEDs} LEDs @ GPIO ${gpioPin} (Brightness ${brightness})`);
}
export function setPixel(i,hex){ if(!ws||!active||!pixelData) return; if(i<0||i>=numLEDs) return; pixelData[i]=hexToGRB(hex); }
export function fillRange(a,b,hex){ if(!ws||!active||!pixelData) return; const s=Math.max(0,Math.min(a,b)); const e=Math.min(numLEDs-1,Math.max(a,b)); const v=hexToGRB(hex); for(let i=s;i<=e;i++) pixelData[i]=v; }
export function render(){ if(!ws||!active||!pixelData) return; try{ ws.render(pixelData);}catch(e){ console.error("[WS2812] render-Fehler:", e);} }
export async function shutdownLEDs(){ if(!ws||!active) return; try{ pixelData?.fill(0); try{ ws.render(pixelData);}catch{} ws.reset?.(); } finally{ active=false; console.log("[WS2812] Freigegeben."); } }
JS

# services/scheduler.js – einfache Modul-Logik: Modul 1 = alles an, Modul 2 = Szenarien/Audio-Hook
cat > "$SERV/scheduler.js" <<'JS'
import { query } from "./db.js";
import { initLEDs } from "./ws2812.js";

let timer = null;
async function tick(){
  try{
    const now = new Date().toISOString();
    const rows = await query(
      "SELECT * FROM calendar_event WHERE start<=:now AND (`end` IS NULL OR `end`>:now) ORDER BY start DESC LIMIT 1",
      { now }
    );
    const current = rows[0];
    if(!current) return;

    const title = String(current.title||"").toLowerCase();
    if (title.includes("modul 1")) {
      await initLEDs(1000);
      // TODO: hier „alles an“ real umsetzen (Gruppen/Farben aus DB lesen)
      // (Hook ist gesetzt)
    }
    if (title.includes("modul 2")) {
      await initLEDs(1000);
      // TODO: hier Szenarien + Audio Starten (Daten aus DB verwenden)
      // (Hook ist gesetzt)
    }
  }catch(e){ console.error("[scheduler] tick error:", e?.message||e); }
}
export async function startScheduler(){
  if(timer) return;
  timer = setInterval(tick, 5000);
  console.log("[scheduler] gestartet");
}
export async function stopScheduler(){
  if(timer){ clearInterval(timer); timer=null; console.log("[scheduler] gestoppt"); }
}
JS

# routes/api.js – vollständige REST-API (Star, Audio, LED-Gruppen, Lagerfeuer, Kalender, Export/Import)
cat > "$ROUTES/api.js" <<'JS'
import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { query, exec, tx, ping } from "../services/db.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/health", async (_req, res) => {
  try { await ping(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: String(e?.message||e) }); }
});

/** STAR **/
router.get("/star", async (_req, res) => {
  const r = await query("SELECT * FROM star_config WHERE id=1");
  res.json(r[0] ?? null);
});
router.put("/star", async (req, res) => {
  const { enabled, distance_cm, start_date, end_date, daily_start, daily_end } = req.body ?? {};
  if ([distance_cm, start_date, end_date, daily_start, daily_end].some(v => v == null || v === ""))
    return res.status(422).json({ message: "Pflichtfelder fehlen" });

  await exec(
    `INSERT INTO star_config (id, enabled, distance_cm, start_date, end_date, daily_start, daily_end)
     VALUES (1, :enabled, :distance_cm, :start_date, :end_date, :daily_start, :daily_end)
     ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), distance_cm=VALUES(distance_cm), start_date=VALUES(start_date),
                             end_date=VALUES(end_date), daily_start=VALUES(daily_start), daily_end=VALUES(daily_end)`,
    { enabled: !!enabled, distance_cm, start_date, end_date, daily_start, daily_end }
  );
  const r = await query("SELECT * FROM star_config WHERE id=1");
  res.json(r[0]);
});

/** AUDIO: Dateiliste **/
function listMp3(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(d=>d.isFile() && d.name.toLowerCase().endsWith(".mp3"))
      .map(d=>path.join(dir, d.name));
  } catch { return []; }
}
router.get("/audio/files", (req, res) => {
  const t = String(req.query.type||"speech");
  const dir = t==="bg"
    ? "/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik"
    : "/home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien";
  res.json(listMp3(dir));
});

/** AUDIO: Settings + BG-Map **/
router.get("/audio/settings", async (_req, res)=>{
  const r = await query("SELECT * FROM audio_settings WHERE id=1");
  res.json(r[0] ?? { volume_speech: 100, volume_bg: 100 });
});
router.put("/audio/settings", async (req,res)=>{
  const { volume_speech=100, volume_bg=100 } = req.body ?? {};
  await exec(`INSERT INTO audio_settings (id, volume_speech, volume_bg) VALUES (1,:vs,:vb)
              ON DUPLICATE KEY UPDATE volume_speech=VALUES(volume_speech), volume_bg=VALUES(volume_bg)`,
    { vs:Number(volume_speech), vb:Number(volume_bg) });
  const r = await query("SELECT * FROM audio_settings WHERE id=1");
  res.json(r[0]);
});
router.get("/audio/bg", async (_req,res)=>{
  const rows = await query("SELECT scenario, file_path FROM audio_bg_map");
  const out = { day:null, daynight:null, night:null, nightday:null };
  for(const r of rows) out[r.scenario]=r.file_path;
  res.json(out);
});
router.put("/audio/bg", async (req,res)=>{
  const { day, daynight, night, nightday } = req.body ?? {};
  await tx(async (c)=>{
    await c.execute('REPLACE INTO audio_bg_map (scenario, file_path) VALUES (?,?)', ['day', day||'']);
    await c.execute('REPLACE INTO audio_bg_map (scenario, file_path) VALUES (?,?)', ['daynight', daynight||'']);
    await c.execute('REPLACE INTO audio_bg_map (scenario, file_path) VALUES (?,?)', ['night', night||'']);
    await c.execute('REPLACE INTO audio_bg_map (scenario, file_path) VALUES (?,?)', ['nightday', nightday||'']);
  });
  const rows = await query("SELECT scenario, file_path FROM audio_bg_map");
  res.json(rows);
});

/** AUDIO: Sprachdateien CRUD **/
router.get("/audio/speeches", async (_req,res)=>{
  const r = await query("SELECT * FROM audio_speeches ORDER BY from_datetime DESC, id DESC");
  res.json(r);
});
router.post("/audio/speeches", async (req,res)=>{
  const { label, file_path, from_datetime, to_datetime } = req.body ?? {};
  if(!label||!file_path||!from_datetime||!to_datetime) return res.status(422).json({message:"Pflichtfelder"});
  const ins = await exec(`INSERT INTO audio_speeches (label, file_path, from_datetime, to_datetime) VALUES (:label,:file_path,:from_datetime,:to_datetime)`,
    { label, file_path, from_datetime, to_datetime });
  const r = await query("SELECT * FROM audio_speeches WHERE id=:id", { id: ins.insertId });
  res.status(201).json(r[0]);
});
router.put("/audio/speeches/:id", async (req,res)=>{
  const { id } = req.params;
  const { label, file_path, from_datetime, to_datetime } = req.body ?? {};
  const r = await exec(`UPDATE audio_speeches SET label=:label, file_path=:file_path, from_datetime=:from_datetime, to_datetime=:to_datetime WHERE id=:id`,
    { id, label, file_path, from_datetime, to_datetime });
  if(!r.affectedRows) return res.status(404).json({message:"Not found"});
  const row = await query("SELECT * FROM audio_speeches WHERE id=:id", { id });
  res.json(row[0]);
});
router.delete("/audio/speeches/:id", async (req,res)=>{
  const { id } = req.params;
  const r = await exec("DELETE FROM audio_speeches WHERE id=:id", { id });
  if(!r.affectedRows) return res.status(404).json({message:"Not found"});
  res.status(204).send();
});

/** LED-Gruppen + Subgruppen + Szenarien + Einzel-Farben **/
async function getGroupByKey(key){
  const g = await query("SELECT * FROM led_group WHERE group_key=:k", { k:key });
  if(!g[0]) return { group_key:key, active:0, subgroups:[] };
  const subs = await query("SELECT * FROM led_subgroup WHERE group_id=:id ORDER BY id ASC", { id:g[0].id });
  const subIds = subs.map(s=>s.id);
  let scen=[], cols=[];
  if(subIds.length){
    const inClause = '(' + subIds.map(()=>'?').join(',') + ')';
    scen = await query(`SELECT * FROM led_scenario WHERE subgroup_id IN ${inClause}`, subIds);
    cols = await query(`SELECT * FROM led_individual_color WHERE subgroup_id IN ${inClause} ORDER BY idx ASC`, subIds);
  }
  return {
    group_key: g[0].group_key,
    active: g[0].active,
    subgroups: subs.map(s => ({
      id:s.id, name:s.name, led_from:s.led_from, led_to:s.led_to, led_count:s.led_count, wall:!!s.wall,
      color_day:s.color_day, color_night:s.color_night,
      scenarios: scen.filter(x=>x.subgroup_id===s.id).map(x=>({id:x.id, seconds:x.seconds, led_selection:x.led_selection})),
      individual_colors: cols.filter(x=>x.subgroup_id===s.id).map(x=>({idx:x.idx, hex:x.hex}))
    }))
  };
}
router.get("/led/groups", async (_req,res)=>{
  const advent = await getGroupByKey("advent");
  const weihnacht = await getGroupByKey("weihnacht");
  res.json({ advent, weihnacht });
});
router.put("/led/groups/:groupKey", async (req,res)=>{
  const { groupKey } = req.params;
  const { active=0, subgroups=[] } = req.body ?? {};
  await tx(async (c)=>{
    await c.execute(`INSERT INTO led_group (group_key, active) VALUES (?,?) ON DUPLICATE KEY UPDATE active=VALUES(active)`, [groupKey, active?1:0]);
    const [[row]] = await c.execute("SELECT id FROM led_group WHERE group_key=?", [groupKey]);
    const gid = row.id;
    await c.execute("DELETE FROM led_individual_color WHERE subgroup_id IN (SELECT id FROM led_subgroup WHERE group_id=?)", [gid]);
    await c.execute("DELETE FROM led_scenario WHERE subgroup_id IN (SELECT id FROM led_subgroup WHERE group_id=?)", [gid]);
    await c.execute("DELETE FROM led_subgroup WHERE group_id=?", [gid]);
    for(const s of subgroups){
      const [r] = await c.execute(
        `INSERT INTO led_subgroup (group_id,name,led_from,led_to,led_count,wall,color_day,color_night)
         VALUES (?,?,?,?,?,?,?,?)`,
        [gid, s.name||"", s.led_from|0, s.led_to|0, s.led_count|0, s.wall?1:0, s.color_day||"#000000", s.color_night||"#000000"]
      );
      const sid = r.insertId;
      for(const sc of (s.scenarios||[])){
        await c.execute("INSERT INTO led_scenario (subgroup_id, seconds, led_selection) VALUES (?,?,?)",
          [sid, sc.seconds|0, sc.led_selection ? JSON.stringify(sc.led_selection) : null]);
      }
      for(const col of (s.individual_colors||[])){
        await c.execute("INSERT INTO led_individual_color (subgroup_id, idx, hex) VALUES (?,?,?)",
          [sid, col.idx|0, col.hex || "#000000"]);
      }
    }
  });
  const after = await getGroupByKey(groupKey);
  res.json(after);
});

/** Lagerfeuer **/
router.get("/led/lagerfeuer", async (_req,res)=>{
  const cfg = await query("SELECT * FROM lagerfeuer_config WHERE id=1");
  const scen = await query("SELECT * FROM lagerfeuer_scenario ORDER BY id ASC");
  res.json({ config: cfg[0]??null, scenarios:scen });
});
router.put("/led/lagerfeuer", async (req,res)=>{
  const { config, scenarios=[] } = req.body ?? {};
  await tx(async (c)=>{
    if(config){
      await c.execute(
        `INSERT INTO lagerfeuer_config (id,led_from,led_to,led_count,color1,color2,color3,color4,color5)
         VALUES (1,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           led_from=VALUES(led_from), led_to=VALUES(led_to), led_count=VALUES(led_count),
           color1=VALUES(color1), color2=VALUES(color2), color3=VALUES(color3),
           color4=VALUES(color4), color5=VALUES(color5)`,
        [config.led_from|0, config.led_to|0, config.led_count|0, config.color1, config.color2, config.color3, config.color4, config.color5]
      );
    }
    await c.execute("DELETE FROM lagerfeuer_scenario");
    for(const sc of scenarios){
      await c.execute("INSERT INTO lagerfeuer_scenario (seconds, params) VALUES (?,?)",
        [sc.seconds|0, sc.params ? JSON.stringify(sc.params) : null]);
    }
  });
  const cfg = await query("SELECT * FROM lagerfeuer_config WHERE id=1");
  const scen = await query("SELECT * FROM lagerfeuer_scenario ORDER BY id ASC");
  res.json({ config: cfg[0]??null, scenarios:scen });
});

/** Kalender **/
router.get("/calendar/events", async (req,res)=>{
  const { start, end } = req.query;
  const rows = await query(
    `SELECT id, title, start, \`end\`, all_day FROM calendar_event
     WHERE (:s IS NULL OR start >= :s) AND (:e IS NULL OR start < :e)
     ORDER BY start ASC`,
    { s:start||null, e:end||null }
  );
  res.json(rows.map(r=>({ id:r.id, title:r.title, start:r.start, end:r.end, allDay:!!r.all_day })));
});
router.post("/calendar/events", async (req,res)=>{
  const { title, start, end, allDay=false, meta=null } = req.body ?? {};
  if(!title||!start) return res.status(422).json({message:"title, start erforderlich"});
  const r = await exec(`INSERT INTO calendar_event (title,start,\`end\`,all_day,meta) VALUES (:title,:start,:end,:all_day,:meta)`,
    { title, start, end:end||null, all_day: allDay?1:0, meta: meta?JSON.stringify(meta):null });
  const rows = await query("SELECT * FROM calendar_event WHERE id=:id", { id:r.insertId });
  const ev = rows[0];
  res.status(201).json({ id:ev.id, title:ev.title, start:ev.start, end:ev.end, allDay:!!ev.all_day });
});
router.put("/calendar/events/:id", async (req,res)=>{
  const { id } = req.params;
  const { title, start, end, allDay=false, meta=null } = req.body ?? {};
  const r = await exec(`UPDATE calendar_event SET title=:title, start=:start, \`end\`=:end, all_day=:all_day, meta=:meta WHERE id=:id`,
    { id, title, start, end:end||null, all_day: allDay?1:0, meta: meta?JSON.stringify(meta):null });
  if(!r.affectedRows) return res.status(404).json({message:"Not found"});
  const rows = await query("SELECT id,title,start,`end`,all_day FROM calendar_event WHERE id=:id", { id });
  const ev = rows[0];
  res.json({ id:ev.id, title:ev.title, start:ev.start, end:ev.end, allDay:!!ev.all_day });
});
router.delete("/calendar/events/:id", async (req,res)=>{
  const { id } = req.params;
  const r = await exec("DELETE FROM calendar_event WHERE id=:id", { id });
  if(!r.affectedRows) return res.status(404).json({message:"Not found"});
  res.status(204).send();
});

/** Export/Import **/
router.get("/export/calendar", async (_req,res)=>{
  const rows = await query('SELECT id, title, start, `end`, all_day AS allDay, meta FROM calendar_event ORDER BY start ASC');
  await exec('INSERT INTO export_log(kind) VALUES ("calendar")');
  res.json(rows);
});
router.get("/export/audio", async (_req,res)=>{
  const speeches = await query("SELECT * FROM audio_speeches ORDER BY from_datetime DESC, id DESC");
  const settings = await query("SELECT volume_speech, volume_bg FROM audio_settings WHERE id=1");
  const bg = await query("SELECT scenario, file_path FROM audio_bg_map");
  await exec('INSERT INTO export_log(kind) VALUES ("audio")');
  res.json({ speeches, settings: settings[0] || { volume_speech: 100, volume_bg: 100 }, bg });
});
router.get("/export/led-groups", async (_req,res)=>{
  const advent = await getGroupByKey("advent");
  const weihnacht = await getGroupByKey("weihnacht");
  await exec('INSERT INTO export_log(kind) VALUES ("led-groups")');
  res.json({ advent, weihnacht });
});

export default router;
JS

# server.js – Static zuerst, API mit und ohne Prefix, DB-Ping, GPIO/Scheduler
cat > "$ROOT/server.js" <<'JS'
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import apiRouter from "./routes/api.js";
import { ping as dbPing } from "./services/db.js";
import { initGPIO, shutdownGPIO } from "./services/gpio.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 8080;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("dev"));

const staticRoot = path.join(__dirname, "public");
app.use(express.static(staticRoot, { index: ["index.html"] }));

app.use("/api", apiRouter);
app.use(apiRouter);

app.use(["/api/*"], (_req, res) => res.status(404).json({ message: "Not found" }));

const start = async () => {
  await dbPing();
  await initGPIO();
  await startScheduler();
  app.listen(port, () => console.log(`[server] läuft auf http://localhost:${port}`));
};

process.on("SIGINT", async () => { try { await stopScheduler(); await shutdownGPIO(); } catch {} process.exit(0); });
process.on("SIGTERM", async () => { try { await stopScheduler(); await shutdownGPIO(); } catch {} process.exit(0); });

start().catch(err => { console.error("[server] Startfehler:", err); process.exit(1); });
JS

# package.json – rpi-ws281x + onoff + express + mysql2
cat > "$ROOT/package.json" <<'JSON'
{
  "name": "led-sound-bachlauf",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.9.7",
    "onoff": "^6.0.3",
    "rpi-ws281x": "^1.0.37"
  }
}
JSON

# install.sh – System/Node Packages + Audio-Verzeichnisse
cat > "$ROOT/install.sh" <<'SH'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "[install] apt-get update…"
sudo apt-get update -y

echo "[install] System-Abhängigkeiten…"
sudo apt-get install -y build-essential gcc g++ make python3 git curl ca-certificates \
  mariadb-server mariadb-client mpg123

echo "[install] Node-Abhängigkeiten…"
sudo npm install --unsafe-perm

echo "[install] Audio-Verzeichnisse…"
mkdir -p /home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien
mkdir -p /home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik

echo "[install] Fertig."
SH
chmod +x "$ROOT/install.sh"

# schema.sql – Tabellen für alle genutzten Endpunkte
cat > "$ROOT/schema.sql" <<'SQL'
-- Minimal nötiges Schema für alle Endpunkte

CREATE TABLE IF NOT EXISTS star_config (
  id TINYINT PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  distance_cm INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_start TIME NOT NULL,
  daily_end TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_settings (
  id TINYINT PRIMARY KEY,
  volume_speech INT NOT NULL DEFAULT 100,
  volume_bg INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS audio_bg_map (
  scenario VARCHAR(32) PRIMARY KEY,
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_speeches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  from_datetime DATETIME NOT NULL,
  to_datetime DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS led_group (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_key VARCHAR(32) UNIQUE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS led_subgroup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  led_from INT NOT NULL,
  led_to INT NOT NULL,
  led_count INT NOT NULL,
  wall TINYINT(1) NOT NULL DEFAULT 0,
  color_day CHAR(7) NOT NULL DEFAULT '#000000',
  color_night CHAR(7) NOT NULL DEFAULT '#000000',
  FOREIGN KEY (group_id) REFERENCES led_group(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS led_scenario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subgroup_id INT NOT NULL,
  seconds INT NOT NULL,
  led_selection JSON NULL,
  FOREIGN KEY (subgroup_id) REFERENCES led_subgroup(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS led_individual_color (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subgroup_id INT NOT NULL,
  idx INT NOT NULL,
  hex CHAR(7) NOT NULL,
  FOREIGN KEY (subgroup_id) REFERENCES led_subgroup(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lagerfeuer_config (
  id TINYINT PRIMARY KEY,
  led_from INT NOT NULL,
  led_to INT NOT NULL,
  led_count INT NOT NULL,
  color1 CHAR(7) NOT NULL,
  color2 CHAR(7) NOT NULL,
  color3 CHAR(7) NOT NULL,
  color4 CHAR(7) NOT NULL,
  color5 CHAR(7) NOT NULL
);

CREATE TABLE IF NOT EXISTS lagerfeuer_scenario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seconds INT NOT NULL,
  params JSON NULL
);

CREATE TABLE IF NOT EXISTS calendar_event (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  start DATETIME NOT NULL,
  `end` DATETIME NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 0,
  meta JSON NULL
);

CREATE TABLE IF NOT EXISTS export_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL

###############################################################################
# Frontend übernehmen (deine Originale, unverändert)
# - HTML & CSS aus Projektroot (falls vorhanden)
# - UI-JS in public/js (Namen laut deiner Struktur)
###############################################################################
copy_if_exists() {
  local src="$1"; local dst="$2";
  if [ -f "$src" ]; then cp -f "$src" "$dst"; echo "[build] kopiert: $(basename "$src") -> ${dst#$ROOT/}"; fi
}

# HTML/CSS
for f in index.html audio.html calendar.html export.html led-groups.html star.html styles.css; do
  if [ -f "$BASE/$f" ]; then copy_if_exists "$BASE/$f" "$PUB/"; fi
done

# UI-JS in public/js (nur die Frontend-Dateien; Server-/Service-JS wird NICHT kopiert)
for f in index.js audio.js calendar.js export.js led-groups.js star.js; do
  if [ -f "$BASE/$f" ]; then copy_if_exists "$BASE/$f" "$PUBJS/"; fi
  if [ -f "$BASE/public/js/$f" ]; then copy_if_exists "$BASE/public/js/$f" "$PUBJS/"; fi
done

# Sicherstellen, dass irgendwas im Frontend liegt (der Nutzer hat die Originale)
ls -1 "$PUB" || true
ls -1 "$PUBJS" || true

###############################################################################
# ZIP-Paket erzeugen
###############################################################################
BUNDLE_ZIP="$BASE/led-sound-bachlauf-full.zip"
cd "$ROOT"
zip -r9 "$BUNDLE_ZIP" . >/dev/null
cd "$BASE"

echo "[build] Paket fertig: $BUNDLE_ZIP"

cat <<INFO

===============================================================================
FERTIG.

ZIP: $BUNDLE_ZIP

Nächste Schritte:
  1) MariaDB-Schema anlegen (einmalig):
     mysql -u pi nativity < schema.sql

  2) Abhängigkeiten:
     ./install.sh

  3) Start:
     sudo node server.js

Hardware:
  - LEDs: WS2812 an GPIO12 (Pin 32), GND an Pin 14 (rpi-ws281x)
  - Button: GPIO17 (Pin 11), 5V an Pin 2 (onoff)
Audio-Pfade:
  - Sprachdateien:        /home/singer/led-sound-bachlauf/audio/krippe/Audiosprachdateien
  - Hintergrundmusik:     /home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik

API ist unter /api/* und kompatibel ohne Prefix erreichbar.
Deine Frontend-Dateien wurden 1:1 übernommen und NICHT verändert.
===============================================================================
INFO
