// services/db.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'pi',
  database: 'nativity',
  password: '',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_520_ci'
});

export { pool };

export async function getConnection() {
  return pool.getConnection();
}

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getSetting(key, fallback = null) {
  const rows = await query('SELECT v FROM settings WHERE k=? LIMIT 1', [key]);
  if (rows.length) return rows[0].v;
  return fallback;
}

export async function setSetting(key, value) {
  await query(
    'INSERT INTO settings (k, v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=CURRENT_TIMESTAMP',
    [key, value]
  );
}

export default {
  pool,
  query,
  getConnection,
  getSetting,
  setSetting
};
