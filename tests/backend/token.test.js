const request = require('supertest');

jest.mock('../../db/database', () => {
  const { createTestDb } = require('../setup/db');
  return createTestDb();
});

const app = require('../../server');

describe('GET /api/token', () => {
  it('returns a 64-character hex token', async () => {
    const res = await request(app).get('/api/token');
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sets the rc_uid cookie', async () => {
    const res = await request(app).get('/api/token');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/rc_uid=/);
  });

  it('returns the same token when a valid cookie is provided', async () => {
    const first = await request(app).get('/api/token');
    const token = first.body.token;
    const cookie = first.headers['set-cookie'][0].split(';')[0]; // rc_uid=<token>

    const second = await request(app)
      .get('/api/token')
      .set('Cookie', cookie);
    expect(second.body.token).toBe(token);
  });

  it('ignores an invalid cookie and issues a new token', async () => {
    const res = await request(app)
      .get('/api/token')
      .set('Cookie', 'rc_uid=notvalidhex');
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
