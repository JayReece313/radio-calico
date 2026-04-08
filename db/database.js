const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'radiocalico.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    email     TEXT    NOT NULL UNIQUE,
    created_at TEXT   DEFAULT (datetime('now'))
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

module.exports = db;
