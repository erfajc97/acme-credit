// Makes sure the Docker engine answers before the boot scripts call compose (G20): when Docker
// Desktop is closed, `pnpm start` opens it and waits instead of failing with a pipe error.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** How to start the engine on this OS, or null when it must be started by hand (Linux). */
export function daemonStartCommand(platform, env, exists = existsSync) {
  if (platform === 'darwin') return { command: 'open', args: ['-a', 'Docker'] };
  if (platform !== 'win32') return null;
  const roots = [env.ProgramFiles, env.ProgramW6432, env.LOCALAPPDATA].filter(Boolean);
  const exe = roots
    .map((dir) => join(dir, 'Docker', 'Docker', 'Docker Desktop.exe'))
    .find((path) => exists(path));
  return exe ? { command: exe, args: [] } : null;
}

const engineAnswers = () =>
  spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' }).status === 0;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once `docker info` answers; starts Docker Desktop when it can. Exits on failure. */
export async function ensureDockerEngine({ timeoutMs = 180_000, say }) {
  if (engineAnswers()) return;
  const start = daemonStartCommand(process.platform, process.env);
  if (!start) {
    say('Docker is not running. Start it (e.g. `sudo systemctl start docker`) and try again.');
    process.exit(1);
  }
  say('Docker is not running: starting Docker Desktop and waiting for the engine…');
  spawn(start.command, start.args, { detached: true, stdio: 'ignore' }).unref();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await pause(3000);
    if (engineAnswers()) {
      say('Docker engine is up.');
      return;
    }
  }
  say(`Docker did not answer within ${timeoutMs / 1000} s. Open Docker Desktop and try again.`);
  process.exit(1);
}
