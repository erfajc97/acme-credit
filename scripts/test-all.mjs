/**
 * `pnpm test:all` — every check of the repository in one command (G20), on any OS.
 * Boots the stack first (integration specs need Postgres, E2E needs every app), then runs each
 * step even when an earlier one fails, and ends with one summary and a non-zero exit if any
 * step failed. `--skip-e2e` and `--skip-stack` exist for machines without Docker.
 */
import { spawnSync } from 'node:child_process';

const say = (line) => process.stdout.write(`${line}\n`);

const args = new Set(process.argv.slice(2));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const steps = [
  !args.has('--skip-stack') && { name: 'stack (docker:up)', cmd: [pnpm, 'docker:up'] },
  { name: 'lint', cmd: [pnpm, 'lint'] },
  { name: 'typecheck', cmd: [pnpm, 'typecheck'] },
  // One package at a time: in parallel the cold Vitest workers hit their 30 s hook timeout.
  {
    name: 'unit tests + coverage',
    cmd: [pnpm, 'exec', 'turbo', 'run', 'test', '--filter=!@acme/e2e', '--concurrency=1'],
  },
  !args.has('--skip-stack') && {
    name: 'integration (real Postgres)',
    cmd: [pnpm, 'test:integration'],
  },
  { name: 'scripts', cmd: [pnpm, 'test:scripts'] },
  { name: 'format', cmd: [pnpm, 'format:check'] },
  !args.has('--skip-e2e') &&
    !args.has('--skip-stack') && { name: 'e2e (1280 + 360)', cmd: [pnpm, 'e2e'] },
].filter(Boolean);

const results = [];
for (const step of steps) {
  say(`\n▶ ${step.name}: ${step.cmd.join(' ')}`);
  const started = Date.now();
  const run = spawnSync(step.cmd[0], step.cmd.slice(1), {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  results.push({
    name: step.name,
    ok: run.status === 0,
    seconds: Math.round((Date.now() - started) / 1000),
  });
  // The stack is a precondition: without it the remaining steps would only report noise.
  if (step.name.startsWith('stack') && run.status !== 0) break;
}

say('\n── test:all summary ──');
for (const r of results) say(`${r.ok ? '✔' : '✘'} ${r.name} (${r.seconds}s)`);
const failed = results.filter((r) => !r.ok).length;
say(failed ? `\n${failed} step(s) failed` : '\nall green');
process.exit(failed ? 1 : 0);
