#!/usr/bin/env node
/*
  scripts/migrate-lagerfeuer.js

  Sicheres Migrationsskript:
  - Legt eine Backup-Kopie von data/led-groups.json an
  - Kopiert das vorhandene top-level `lagerfeuer` in `adventLagerfeuer` und `weihnachtLagerfeuer`,
    falls diese Felder noch nicht existieren (Standard) oder wenn --force gesetzt ist
  - Optional: entfernt das top-level `lagerfeuer` nach dem Kopieren, wenn --remove-top gesetzt ist

  Usage (PowerShell auf dem Pi oder lokal):
    node scripts/migrate-lagerfeuer.js         # safe run, only copy if group fields missing
    node scripts/migrate-lagerfeuer.js --force # overwrite group fields even if present
    node scripts/migrate-lagerfeuer.js --remove-top # remove top-level lagerfeuer after copying
    node scripts/migrate-lagerfeuer.js --force --remove-top

  Das Skript ist idempotent: ohne --force ändert es nur fehlende Einträge.
*/

import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'led-groups.json');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function usage() {
  console.log('Usage: node scripts/migrate-lagerfeuer.js [--force] [--remove-top]');
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); return; }
  const force = args.includes('--force');
  const removeTop = args.includes('--remove-top');

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    const top = data.lagerfeuer ? data.lagerfeuer : null;
    if (!top) {
      console.log('Kein top-level `lagerfeuer` gefunden. Nichts zu tun.');
      return;
    }

    const backupPath = DATA_FILE + '.bak.' + nowStamp();
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Backup erstellt:', backupPath);

    let changed = false;

    if (!data.adventLagerfeuer || force) {
      data.adventLagerfeuer = top;
      console.log((!data.adventLagerfeuer || force) ? (force ? 'adventLagerfeuer überschrieben' : 'adventLagerfeuer gesetzt') : '');
      changed = true;
    } else {
      console.log('adventLagerfeuer bereits vorhanden — überspringe (use --force to overwrite)');
    }

    if (!data.weihnachtLagerfeuer || force) {
      data.weihnachtLagerfeuer = top;
      console.log((!data.weihnachtLagerfeuer || force) ? (force ? 'weihnachtLagerfeuer überschrieben' : 'weihnachtLagerfeuer gesetzt') : '');
      changed = true;
    } else {
      console.log('weihnachtLagerfeuer bereits vorhanden — überspringe (use --force to overwrite)');
    }

    if (removeTop) {
      if (data.lagerfeuer) {
        delete data.lagerfeuer;
        changed = true;
        console.log('Top-level `lagerfeuer` entfernt (remove-top).');
      } else {
        console.log('Kein top-level `lagerfeuer` mehr vorhanden.');
      }
    }

    if (!changed) {
      console.log('Keine Änderungen notwendig. Abbruch.');
      return;
    }

    // Write back
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Datei geschrieben:', DATA_FILE);
    console.log('Migration abgeschlossen. Prüfe die Datei oder lade die Web-UI neu.');
  } catch (err) {
    console.error('Fehler:', err.message || err);
    process.exitCode = 2;
  }
}

run();
