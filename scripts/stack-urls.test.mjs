import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatUrls, parseEnv, stackUrls } from './stack-urls.mjs';

test('reads the ports a person changed in .env, CRLF and comments included', () => {
  const env = parseEnv('# ports\r\nWEB_PORT=5000\r\n\r\nADMIN_PORT = 5001\nAPI_PORT=');
  assert.deepEqual(env, { WEB_PORT: '5000', ADMIN_PORT: '5001', API_PORT: '' });
  const urls = Object.fromEntries(stackUrls(env));
  assert.equal(urls['Customer wallet'], 'http://localhost:5000');
  assert.equal(urls['Admin console'], 'http://localhost:5001');
  // An empty value falls back to the compose default, like ${API_PORT:-3000}.
  assert.equal(urls['Lending core API'], 'http://localhost:3000/health');
});

test('lists the API docs of both backends on their ports', () => {
  const urls = Object.fromEntries(stackUrls({ API_PORT: '4000' }));
  assert.equal(urls['API docs'], 'http://localhost:4000/docs');
  assert.equal(urls['Card network API docs'], 'http://localhost:3001/docs');
});

test('infra mode lists only what it starts', () => {
  assert.deepEqual(
    stackUrls({}, 'infra').map(([name]) => name),
    ['Postgres', 'Object storage (S3 API)', 'Object storage console'],
  );
});

test('formats one aligned line per service', () => {
  assert.equal(
    formatUrls([
      ['A', 'x'],
      ['Long', 'y'],
    ]),
    '  A     x\n  Long  y',
  );
});
