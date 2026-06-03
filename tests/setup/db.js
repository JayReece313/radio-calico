const Database = require('better-sqlite3');

function createTestDb() {
  const db = new Database(':memory:');
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
  // pg-compatible query() adapter — routes/api.js uses await db.query() exclusively
  db.query = function(text, params = []) {
    const sql = text.replace(/\$\d+/g, '?');
    const upper = sql.trim().toUpperCase();
    const returningMatch = sql.match(/\sRETURNING\s+(\w+)/i);
    if (upper.startsWith('SELECT')) {
      const rows = this.prepare(sql).all(...(params || []));
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    if (returningMatch) {
      const col = returningMatch[1];
      const info = this.prepare(sql.replace(/\sRETURNING\s+\w+/i, '')).run(...(params || []));
      return Promise.resolve({ rows: [{ [col]: info.lastInsertRowid }], rowCount: 1 });
    }
    const info = this.prepare(sql).run(...(params || []));
    return Promise.resolve({ rows: [], rowCount: info.changes });
  };
  db.ready = Promise.resolve();

  return db;
}

module.exports = { createTestDb };
