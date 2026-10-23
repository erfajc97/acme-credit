#!/usr/bin/env node
// Boot dispatcher (G20): creates .env on the first run (fresh random secrets and seed passwords,
// see env-template.mjs), then hands
// the boot to up.ps1 (Windows) or up.sh (everywhere else). Modes: up (whole stack, waits for
// healthy; builds only images that do not exist yet), rebuild (same, rebuilding every image
// from the current code), infra (Postgres + object storage only), down (stop, keep data),
// reset (wipe volumes and boot again). Docker Desktop is opened first when it is closed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDockerEngine } from './docker-daemon.mjs';
import { renderEnvTemplate } from './env-template.mjs';
import { formatUrls, parseEnv, stackUrls } from './stack-urls.mjs';

const MODES = ['up', 'rebuild', 'infra', 'down', 'reset'];
const mode = process.argv[2] ?? 'up';
if (!MODES.includes(mode)) {
  process.stderr.write(`Unknown mode "${mode}". Use one of: ${MODES.join(', ')}\n`);
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');

if (!existsSync(envFile)) {
  const template = readFileSync(join(root, '.env.example'), 'utf8');
  // Every secret and seed password differs per machine (scripts/env-template.mjs).
  writeFileSync(envFile, renderEnvTemplate(template));
  process.stdout.write('Created .env from .env.example with fresh random secrets and passwords\n');
}

const say = (line) => process.stdout.write(`${line}\n`);

await ensureDockerEngine({ say });

const here = join(root, 'scripts');
const [command, args] =
  process.platform === 'win32'
    ? [
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'up.ps1'), mode],
      ]
    : ['sh', [join(here, 'up.sh'), mode]];

const result = spawnSync(command, args, { stdio: 'inherit', cwd: root });

if (result.status === 0 && mode !== 'down') {
  const urls = stackUrls(parseEnv(readFileSync(envFile, 'utf8')), mode);
  say(`\nAcme Credit is up:\n${formatUrls(urls)}\n\nStop everything: pnpm stop`);
}
if (result.status === 0 && mode === 'down') say('\nAcme Credit stopped (data kept).');
process.exit(result.status ?? 1);
