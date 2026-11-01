import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

test('GET /api/health returns ok', async () => {
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../server.js');

  const res = await httpRequest(app, 'GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
});

test('GET unknown route returns 404 JSON error', async () => {
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../server.js');

  const res = await httpRequest(app, 'GET', '/api/nonexistent');
  assert.equal(res.status, 404);
  const body = JSON.parse(res.body);
  assert.ok(body.error);
});

test('GET /api/pulse without url returns 400', async () => {
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../server.js');

  const res = await httpRequest(app, 'GET', '/api/pulse');
  assert.equal(res.status, 400);
  const body = JSON.parse(res.body);
  assert.ok(body.error);
});

/**
 * Make an HTTP request against an Express app without starting a manual server.
 * @param {import('express').Express} app
 * @param {string} method
 * @param {string} path
 * @returns {Promise<{status: number, body: string}>}
 */
function httpRequest(app, method, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.request(
        { method, host: '127.0.0.1', port, path },
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, body });
          });
        },
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}
