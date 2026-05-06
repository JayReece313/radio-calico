const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../db/database');

// ── Token ──────────────────────────────────────────────────────────────────
function parseCookie(header, name) {
  if (!header) return null;
  const pair = (header.split(';')).map(s => s.trim()).find(s => s.startsWith(name + '='));
  return pair ? pair.slice(name.length + 1) : null;
}

const COOKIE_OPTIONS = {
  maxAge: 365 * 24 * 3600 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
};

router.get('/token', (req, res) => {
  const existing = parseCookie(req.headers.cookie, 'rc_uid');
  if (existing && /^[0-9a-f]{64}$/.test(existing)) {
    res.cookie('rc_uid', existing, COOKIE_OPTIONS);
    return res.json({ token: existing });
  }
  const ip    = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')).split(',')[0].trim();
  const token = crypto.createHash('sha256').update(`radiocalico:${ip}`).digest('hex');
  res.cookie('rc_uid', token, COOKIE_OPTIONS);
  res.json({ token });
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', db: process.env.DATABASE_URL ? 'postgres' : 'sqlite' });
});

// ── Users ──────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const result = await db.query('SELECT * FROM users ORDER BY created_at DESC');
  res.json(result.rows);
});

router.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const result = await db.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
    [name, email]
  );
  res.status(201).json({ id: result.rows[0].id, name, email });
});

// ── Posts ──────────────────────────────────────────────────────────────────
router.get('/posts', async (req, res) => {
  const result = await db.query('SELECT * FROM posts ORDER BY created_at DESC');
  res.json(result.rows);
});

router.post('/posts', async (req, res) => {
  const { title, body, user_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const result = await db.query(
    'INSERT INTO posts (title, body, user_id) VALUES ($1, $2, $3) RETURNING id',
    [title, body ?? null, user_id ?? null]
  );
  res.status(201).json({ id: result.rows[0].id, title, body, user_id });
});

// ── Ratings ────────────────────────────────────────────────────────────────
router.get('/ratings', async (req, res) => {
  const { song_key, user_token } = req.query;
  if (!song_key) return res.status(400).json({ error: 'song_key required' });

  const countsResult = await db.query(`
    SELECT
      SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS thumbs_up,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS thumbs_down
    FROM song_ratings WHERE song_key = $1
  `, [song_key]);

  const userResult = user_token
    ? await db.query(
        'SELECT rating FROM song_ratings WHERE song_key = $1 AND user_token = $2',
        [song_key, user_token]
      )
    : null;

  const counts  = countsResult.rows[0];
  const userRow = userResult ? userResult.rows[0] : null;

  res.json({
    thumbs_up:   counts.thumbs_up   || 0,
    thumbs_down: counts.thumbs_down || 0,
    user_rating: userRow ? userRow.rating : null,
  });
});

router.post('/ratings', async (req, res) => {
  const { song_key, rating, user_token } = req.body;
  if (!song_key || !user_token) return res.status(400).json({ error: 'song_key and user_token required' });
  if (rating !== 1 && rating !== -1)  return res.status(400).json({ error: 'rating must be 1 or -1' });

  await db.query(`
    INSERT INTO song_ratings (song_key, rating, user_token)
    VALUES ($1, $2, $3)
    ON CONFLICT (song_key, user_token) DO UPDATE SET rating = EXCLUDED.rating
  `, [song_key, rating, user_token]);

  const countsResult = await db.query(`
    SELECT
      SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS thumbs_up,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS thumbs_down
    FROM song_ratings WHERE song_key = $1
  `, [song_key]);

  const counts = countsResult.rows[0];
  res.status(201).json({
    thumbs_up:   counts.thumbs_up   || 0,
    thumbs_down: counts.thumbs_down || 0,
    user_rating: rating,
  });
});

module.exports = router;
