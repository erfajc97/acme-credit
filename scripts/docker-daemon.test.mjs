import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { daemonStartCommand } from './docker-daemon.mjs';

const desktopIn = (dir) => join(dir, 'Docker', 'Docker', 'Docker Desktop.exe');

test('Windows opens Docker Desktop from Program Files when it is installed there', () => {
  const env = { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' };
  const found = daemonStartCommand('win32', env, (path) => path === desktopIn(env.ProgramFiles));
  assert.deepEqual(found, { command: desktopIn(env.ProgramFiles), args: [] });
});

test('Windows falls back to a per-user install', () => {
  const env = { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' };
  const found = daemonStartCommand('win32', env, (path) => path === desktopIn(env.LOCALAPPDATA));
  assert.equal(found?.command, desktopIn(env.LOCALAPPDATA));
});

test('Windows without Docker Desktop installed cannot start it', () => {
  assert.equal(
    daemonStartCommand('win32', { ProgramFiles: 'C:\\x' }, () => false),
    null,
  );
});

test('macOS opens the Docker app; Linux must start the service by hand', () => {
  assert.deepEqual(daemonStartCommand('darwin', {}), { command: 'open', args: ['-a', 'Docker'] });
  assert.equal(daemonStartCommand('linux', {}), null);
});
