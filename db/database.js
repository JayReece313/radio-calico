'use strict';
const path = require('path');

if (process.env.DATABASE_URL) {
  // ── PostgreSQL (production) ────────────────────────────────────────────
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const ready = (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id         BIGSERIAL PRIMARY KEY,
          name       TEXT      NOT NULL,
          email      TEXT      NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id         BIGSERIAL PRIMARY KEY,
          title      TEXT      NOT NULL,
          body       TEXT,
          user_id    BIGINT    REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS song_ratings (
          id         BIGSERIAL PRIMARY KEY,
          song_key   TEXT      NOT NULL,
          rating     INTEGER   NOT NULL CHECK (rating IN (1, -1)),
          user_token TEXT      NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (song_key, user_token)
        )
      `);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })();

  ready.catch(err => { console.error('Schema init failed:', err); process.exit(1); });

  pool.ready = ready;
  module.exports = pool;

} else {
  // ── SQLite (development / no DATABASE_URL set) ─────────────────────────
  // better-sqlite3 is a devDependency; never required in production
  const Database = require('better-sqlite3');
  const db = new Database(path.join(__dirname, 'radiocalico.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      created_at TEXT    DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      body       TEXT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT    DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS song_ratings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      song_key   TEXT    NOT NULL,
      rating     INTEGER NOT NULL CHECK (rating IN (1, -1)),
      user_token TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now')),
      UNIQUE (song_key, user_token)
    );
  `);

  // pg-compatible query() adapter — converts $N params to ?, returns Promises
  // so routes/api.js is identical code in both dev (SQLite) and prod (pg)
  db.query = function(text, params = []) {
    const sql = text.replace(/\$\d+/g, '?');
    const upper = sql.trim().toUpperCase();
    const returningMatch = sql.match(/\sRETURNING\s+(\w+)/i);

    if (upper.startsWith('SELECT')) {
      const rows = this.prepare(sql).all(...params);
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (returningMatch) {
      const col = returningMatch[1];
      const info = this.prepare(sql.replace(/\sRETURNING\s+\w+/i, '')).run(...params);
      return Promise.resolve({ rows: [{ [col]: info.lastInsertRowid }], rowCount: 1 });
    }
    const info = this.prepare(sql).run(...params);
    return Promise.resolve({ rows: [], rowCount: info.changes });
  };

  db.ready = Promise.resolve();
  module.exports = db;
}
