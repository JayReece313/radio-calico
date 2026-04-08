const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../db/database');

// ── Token ─────────────────────────────────────────────────────────────
function parseCookie(header, name) {
  if (!header) return null;
  const pair = (header.split(';')).map(s => s.trim()).find(s => s.startsWith(name + '='));
  return pair ? pair.slice(name.length + 1) : null;
}

router.get('/token', (req, res) => {
  const existing = parseCookie(req.headers.cookie, 'rc_uid');
  if (existing && /^[0-9a-f]{64}$/.test(existing)) {
    res.cookie('rc_uid', existing, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'strict' });
    return res.json({ token: existing });
  }
  const ip    = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')).split(',')[0].trim();
  const token = crypto.createHash('sha256').update(`radiocalico:${ip}`).digest('hex');
  res.cookie('rc_uid', token, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'strict' });
  res.json({ token });
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: 'sqlite' });
});

// --- Users ---
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
  const info  = stmt.run(name, email);
  res.status(201).json({ id: info.lastInsertRowid, name, email });
});

// --- Posts ---
router.get('/posts', (req, res) => {
  const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/posts', (req, res) => {
  const { title, body, user_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const stmt = db.prepare('INSERT INTO posts (title, body, user_id) VALUES (?, ?, ?)');
  const info  = stmt.run(title, body ?? null, user_id ?? null);
  res.status(201).json({ id: info.lastInsertRowid, title, body, user_id });
});

// --- Ratings ---
router.get('/ratings', (req, res) => {
  const { song_key, user_token } = req.query;
  if (!song_key) return res.status(400).json({ error: 'song_key required' });

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS thumbs_up,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS thumbs_down
    FROM song_ratings WHERE song_key = ?
  `).get(song_key);

  const userRow = user_token
    ? db.prepare('SELECT rating FROM song_ratings WHERE song_key = ? AND user_token = ?').get(song_key, user_token)
    : null;

  res.json({
    thumbs_up:   counts.thumbs_up   || 0,
    thumbs_down: counts.thumbs_down || 0,
    user_rating: userRow ? userRow.rating : null,
  });
});

router.post('/ratings', (req, res) => {
  const { song_key, rating, user_token } = req.body;
  if (!song_key || !user_token) return res.status(400).json({ error: 'song_key and user_token required' });
  if (rating !== 1 && rating !== -1)  return res.status(400).json({ error: 'rating must be 1 or -1' });

  db.prepare('INSERT OR REPLACE INTO song_ratings (song_key, rating, user_token) VALUES (?, ?, ?)')
    .run(song_key, rating, user_token);

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS thumbs_up,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS thumbs_down
    FROM song_ratings WHERE song_key = ?
  `).get(song_key);

  res.status(201).json({
    thumbs_up:   counts.thumbs_up   || 0,
    thumbs_down: counts.thumbs_down || 0,
    user_rating: rating,
  });
});

module.exports = router;
