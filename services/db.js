import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { Log } from './log.js';

let db = null;

export async function initDB() {
  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.resolve(config.dbFile);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS led_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_index INTEGER NOT NULL,
      length INTEGER NOT NULL,
      color TEXT DEFAULT '#ffffff'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_led_groups_name ON led_groups(name);

    CREATE TABLE IF NOT EXISTS calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start_ts INTEGER NOT NULL,
      end_ts INTEGER NOT NULL,
      module INTEGER NOT NULL CHECK (module IN (1,2)),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM led_groups').get().c;
  if (count === 0) {
    const defaults = [
      ['Turm', 0, 120],
      ['Von Turm zur Krippe', 120, 80],
      ['Krippe rechts', 200, 90],
      ['Krippe innen', 290, 90],
      ['Krippe Links', 380, 90],
      ['Wand von Krippe zum Tor', 470, 100],
      ['Torbogen', 570, 60],
      ['Wand vom Tor zum Palast', 630, 120],
      ['Laterne', 750, 10],
      ['Palast', 760, 140]
    ];
    const ins = db.prepare('INSERT INTO led_groups (name, start_index, length, color) VALUES (?,?,?,?)');
    for (const d of defaults) ins.run(...d, '#ffffff');
    Log.success('Standard-LED-Gruppen initialisiert.');
  }
  Log.success('Datenbank bereit: ' + dbPath);
}

export function getDB() {
  if (!db) throw new Error('DB not initialized');
  return db;
}
