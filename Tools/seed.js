// services/seed.js
const db = require('./db');
const scenarioCtrl = require('./scenario-controll');
const ledCtrl = require('./led-controll');
const audioScenario = require('./audio-scenario');

async function seedDatabase() {
  try {
    console.log('[SEED] Starte Datenbankinitialisierung...');

    // Beispiel: LED-Gruppen
    await db.query(`INSERT INTO led_groups (name, active) VALUES ('Advent', 1), ('Weihnachtszeit', 1)`);

    // Beispiel: Untergruppen
    await db.query(`
      INSERT INTO led_subgroups 
      (group_id, name, led_from, led_to, led_count, wall, color_day, color_night)
      VALUES
      (1, 'Krippe', 1, 15, 15, 1, '#FFFF00', '#FF0000'),
      (2, 'Baum', 16, 50, 35, 0, '#00FF00', '#0000FF')
    `);

    // Beispiel: Szenarios
    await db.query(`
      INSERT INTO scenarios 
      (name, duration, module)
      VALUES
      ('Tag', 50, 2),
      ('Tag-Nacht', 100, 2),
      ('Nacht', 60, 2),
      ('Nacht-Tag', 100, 2)
    `);

    // Beispiel: Audio Szenarios
    await db.query(`
      INSERT INTO audio_entries
      (type, name, start_time, end_time, file_path)
      VALUES
      ('speech', 'Begrüßung', '08:00', '08:30', '/home/singer/led-sound-bachlauf/audio/krippe/Audioprachdateien/begrüßung.mp3'),
      ('music', 'Tag', '00:00', '23:59', '/home/singer/led-sound-bachlauf/audio/krippe/Hintergrundmusik/tag.mp3')
    `);

    console.log('[SEED] Datenbankinitialisierung abgeschlossen.');
  } catch (err) {
    console.error('[SEED] Fehler beim Seed:', err);
  } finally {
    db.close();
  }
}

module.exports = {
  seedDatabase
};

// Wenn direkt ausgeführt wird
if (require.main === module) {
  seedDatabase();
}
