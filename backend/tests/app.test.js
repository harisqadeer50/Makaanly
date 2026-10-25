import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { toSqft, fromSqft } from '../src/utils/areaConvert.js';

const app = createApp();

describe('API foundation', () => {
  it('GET /api/health returns the success envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"bad":');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/json/i);
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('blocks untrusted CORS origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('area conversion', () => {
  it('converts marla, kanal and square yards to sq ft', () => {
    expect(toSqft(1, 'marla')).toBe(272.25);
    expect(toSqft(1, 'kanal')).toBe(5445);
    expect(toSqft(10, 'sqyd')).toBe(90);
    expect(toSqft(500, 'sqft')).toBe(500);
  });
  it('round-trips and rejects bad input', () => {
    expect(fromSqft(5445, 'kanal')).toBe(1);
    expect(() => toSqft(-1, 'marla')).toThrow();
    expect(() => toSqft(1, 'acre')).toThrow();
  });
});
