const request = require('supertest');

// Must be hoisted before any require of the real db or server
jest.mock('../../db/database', () => {
  const { createTestDb } = require('../setup/db');
  return createTestDb();
});

const app = require('../../server');
const db  = require('../../db/database');

beforeEach(() => {
  db.prepare('DELETE FROM song_ratings').run();
});

describe('GET /api/ratings', () => {
  it('returns zeros and null user_rating for an unrated song', async () => {
    const res = await request(app)
      .get('/api/ratings?song_key=artist%7C%7Ctitle&user_token=user1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ thumbs_up: 0, thumbs_down: 0, user_rating: null });
  });

  it('requires song_key', async () => {
    const res = await request(app).get('/api/ratings?user_token=user1');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns correct counts after votes exist', async () => {
    db.prepare('INSERT INTO song_ratings (song_key, rating, user_token) VALUES (?, ?, ?)')
      .run('artist||title', 1, 'user1');
    db.prepare('INSERT INTO song_ratings (song_key, rating, user_token) VALUES (?, ?, ?)')
      .run('artist||title', -1, 'user2');

    const res = await request(app)
      .get('/api/ratings?song_key=artist%7C%7Ctitle&user_token=user3');
    expect(res.status).toBe(200);
    expect(res.body.thumbs_up).toBe(1);
    expect(res.body.thumbs_down).toBe(1);
    expect(res.body.user_rating).toBeNull();
  });

  it('returns user_rating for the requesting user', async () => {
    db.prepare('INSERT INTO song_ratings (song_key, rating, user_token) VALUES (?, ?, ?)')
      .run('artist||title', 1, 'user1');

    const res = await request(app)
      .get('/api/ratings?song_key=artist%7C%7Ctitle&user_token=user1');
    expect(res.body.user_rating).toBe(1);
  });

  it('returns null user_rating for a different user', async () => {
    db.prepare('INSERT INTO song_ratings (song_key, rating, user_token) VALUES (?, ?, ?)')
      .run('artist||title', 1, 'user1');

    const res = await request(app)
      .get('/api/ratings?song_key=artist%7C%7Ctitle&user_token=user2');
    expect(res.body.user_rating).toBeNull();
  });
});

describe('POST /api/ratings', () => {
  it('creates a new thumbs-up rating', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 1, user_token: 'user1' });
    expect(res.status).toBe(201);
    expect(res.body.thumbs_up).toBe(1);
    expect(res.body.thumbs_down).toBe(0);
    expect(res.body.user_rating).toBe(1);
  });

  it('creates a new thumbs-down rating', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: -1, user_token: 'user1' });
    expect(res.status).toBe(201);
    expect(res.body.thumbs_down).toBe(1);
    expect(res.body.user_rating).toBe(-1);
  });

  it('replaces an existing vote without doubling counts', async () => {
    await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 1, user_token: 'user1' });

    const res = await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: -1, user_token: 'user1' });

    expect(res.status).toBe(201);
    expect(res.body.thumbs_up).toBe(0);
    expect(res.body.thumbs_down).toBe(1);
    expect(res.body.user_rating).toBe(-1);
  });

  it('accumulates votes from multiple users correctly', async () => {
    await request(app).post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 1, user_token: 'user1' });
    await request(app).post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 1, user_token: 'user2' });
    await request(app).post('/api/ratings')
      .send({ song_key: 'artist||title', rating: -1, user_token: 'user3' });

    const res = await request(app)
      .get('/api/ratings?song_key=artist%7C%7Ctitle&user_token=user1');
    expect(res.body.thumbs_up).toBe(2);
    expect(res.body.thumbs_down).toBe(1);
  });

  it('rejects rating of 0', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 0, user_token: 'user1' });
    expect(res.status).toBe(400);
  });

  it('rejects missing song_key', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ rating: 1, user_token: 'user1' });
    expect(res.status).toBe(400);
  });

  it('rejects missing user_token', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ song_key: 'artist||title', rating: 1 });
    expect(res.status).toBe(400);
  });
});
