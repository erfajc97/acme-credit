// node --test scripts/ — the first-run .env must never carry a shared demo password (P0 security).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderEnvTemplate } from './env-template.mjs';

const TEMPLATE = [
  '# comment with <generate> stays as it is',
  'JWT_SECRET=<generate>',
  'SEED_ADMIN_EMAIL=admin@acme.test',
  'SEED_ADMIN_PASSWORD=<generate>',
  'SEED_CUSTOMER_PASSWORD=<generate>',
  'PUBLIC_DEMO_ADMIN_EMAIL=<same:SEED_ADMIN_EMAIL>',
  'PUBLIC_DEMO_ADMIN_PASSWORD=<same:SEED_ADMIN_PASSWORD>',
  'PUBLIC_DEMO_PASSWORD=<same:SEED_CUSTOMER_PASSWORD>',
  'PUBLIC_DEMO_MODE=true',
  '',
].join('\n');

const parse = (env) =>
  Object.fromEntries(
    env
      .split('\n')
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );

test('secrets become 48 url-safe random characters', () => {
  const { JWT_SECRET } = parse(renderEnvTemplate(TEMPLATE));
  assert.match(JWT_SECRET, /^[A-Za-z0-9_-]{48}$/);
});

test('seed passwords are human-typable: 20 characters with letters, digits and a symbol', () => {
  const env = parse(renderEnvTemplate(TEMPLATE));
  for (const key of ['SEED_ADMIN_PASSWORD', 'SEED_CUSTOMER_PASSWORD']) {
    const password = env[key];
    assert.equal(password.length, 20, key);
    assert.match(password, /[A-Z]/, key);
    assert.match(password, /[a-z]/, key);
    assert.match(password, /[0-9]/, key);
    // Only characters that survive .env files, compose interpolation and a shell paste.
    assert.match(password, /^[A-Za-z0-9!@%+._-]+$/, key);
    assert.match(password, /[!@%+._-]/, key);
  }
  assert.notEqual(env.SEED_ADMIN_PASSWORD, env.SEED_CUSTOMER_PASSWORD);
});

test('every run draws new values', () => {
  const first = parse(renderEnvTemplate(TEMPLATE));
  const second = parse(renderEnvTemplate(TEMPLATE));
  assert.notEqual(first.SEED_ADMIN_PASSWORD, second.SEED_ADMIN_PASSWORD);
  assert.notEqual(first.JWT_SECRET, second.JWT_SECRET);
});

test('<same:KEY> mirrors the value generated above it, so the demo buttons match the seed', () => {
  const env = parse(renderEnvTemplate(TEMPLATE));
  assert.equal(env.PUBLIC_DEMO_ADMIN_EMAIL, 'admin@acme.test');
  assert.equal(env.PUBLIC_DEMO_ADMIN_PASSWORD, env.SEED_ADMIN_PASSWORD);
  assert.equal(env.PUBLIC_DEMO_PASSWORD, env.SEED_CUSTOMER_PASSWORD);
});

test('comments, blank lines, plain values and CRLF line endings are kept', () => {
  const crlf = TEMPLATE.replaceAll('\n', '\r\n');
  const out = renderEnvTemplate(crlf);
  assert.ok(out.startsWith('# comment with <generate> stays as it is\r\n'));
  assert.ok(out.includes('\r\nPUBLIC_DEMO_MODE=true\r\n'));
  assert.equal(out.split('\r\n').length, crlf.split('\r\n').length);
  assert.equal(parse(out.replaceAll('\r', '')).PUBLIC_DEMO_PASSWORD.length, 20);
});

test('a mirror of a key that is not defined above it fails, naming both keys', () => {
  assert.throws(
    () => renderEnvTemplate('PUBLIC_DEMO_PASSWORD=<same:SEED_CUSTOMER_PASSWORD>\n'),
    /PUBLIC_DEMO_PASSWORD mirrors SEED_CUSTOMER_PASSWORD/,
  );
});
