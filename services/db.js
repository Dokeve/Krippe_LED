// services/db.js
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'pi',
  database: 'nativity',
  // kein Passwort: unix_socket Auth
  password: '',          // leer lassen
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_520_ci'
});

// Hilfsfunktion für einfache KV-Settings
export async function getSetting(key, fallback = null) {
  const [rows] = await pool.query('SELECT v FROM settings WHERE k=? LIMIT 1', [key]);
  if (rows.length) return rows[0].v;
  return fallback;
}

export async function setSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (k, v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=CURRENT_TIMESTAMP',
    [key, value]
  );
}
