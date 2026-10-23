// Container start (one cross-platform command): apply migrations, seed, then serve.
// Each step must succeed before the next: a failed migration never boots the API.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');

function run(label, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    process.stderr.write(`start-prod: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status ?? 1);
  }
}

run('prisma migrate deploy', [prismaCli, 'migrate', 'deploy']);
run('seed', [join(root, 'dist', 'seed.js')]);
await import(new URL('../dist/main.js', import.meta.url).href);
