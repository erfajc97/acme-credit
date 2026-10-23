// What `pnpm start` prints once the stack is healthy (G20): every exposed service with the port
// it took from .env, so nobody has to read docker-compose.yml to find them.

/** Parses KEY=value lines of a .env file (comments and blanks ignored, no expansion). */
export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

/** The services a person opens, with the same defaults docker-compose.yml uses. */
export function stackUrls(env, mode = 'up') {
  const port = (key, fallback) => env[key] || fallback;
  const infra = [
    ['Postgres', `localhost:${port('POSTGRES_HOST_PORT', '5434')}`],
    ['Object storage (S3 API)', `http://localhost:${port('S3_HOST_PORT', '9000')}`],
    [
      'Object storage console',
      `http://localhost:${port('S3_CONSOLE_HOST_PORT', '9001')}/rustfs/console/`,
    ],
  ];
  if (mode === 'infra') return infra;
  return [
    ['Customer wallet', `http://localhost:${port('WEB_PORT', '4321')}`],
    ['Admin console', `http://localhost:${port('ADMIN_PORT', '4322')}`],
    ['Lending core API', `http://localhost:${port('API_PORT', '3000')}/health`],
    ['API docs', `http://localhost:${port('API_PORT', '3000')}/docs`],
    ['Card network + bank simulator', `http://localhost:${port('NETWORK_PORT', '3001')}/health`],
    ['Card network API docs', `http://localhost:${port('NETWORK_PORT', '3001')}/docs`],
    ...infra,
  ];
}

/** A two-column block that fits any terminal width. */
export function formatUrls(rows) {
  const width = Math.max(...rows.map(([name]) => name.length));
  return rows.map(([name, url]) => `  ${name.padEnd(width)}  ${url}`).join('\n');
}
