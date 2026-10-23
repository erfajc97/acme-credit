/**
 * Read-path benchmark (owner request: "faster data requests").
 *
 * Creates a THROWAWAY database on the compose Postgres (never the dev database), applies the real
 * migrations, inserts ~40k rows (one heavy customer with thousands of activity rows, hundreds of
 * other accounts, a long ledger and audit log), boots the real app on a random port and times the
 * main GETs over HTTP. Prints p50/p95 per route, then drops the database.
 *
 *   pnpm --filter @acme/api bench:reads            (from the repo root; Postgres must be up)
 *
 * The global rate limit is disabled for this process only: the point is to time the database and
 * serialization work, not the throttler.
 */
import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Client } from 'pg';

const ROOT_ENV = '../../.env';
const PRISMA_CLI = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const WARMUP = 10;
const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 100);

function postgresUrl(database: string): string {
  const fromFile = existsSync(ROOT_ENV) ? parseEnv(readFileSync(ROOT_ENV, 'utf8')) : {};
  const pick = (key: string, fallback?: string) => {
    const value = process.env[key] ?? fromFile[key] ?? fallback;
    if (value === undefined) throw new Error(`bench needs ${key} (env or .env)`);
    return value;
  };
  const credentials = `${encodeURIComponent(pick('POSTGRES_USER'))}:${encodeURIComponent(pick('POSTGRES_PASSWORD'))}`;
  return `postgresql://${credentials}@${pick('POSTGRES_HOST', '127.0.0.1')}:${pick('POSTGRES_HOST_PORT', '5434')}/${database}`;
}

/** Synthetic data, all generated inside Postgres (no values interpolated into SQL, A2). */
const SEED_SQL = [
  `INSERT INTO users (id, email, password_hash, full_name, role, updated_at)
     SELECT gen_random_uuid(), 'bench-' || n || '@acme.test', 'not-a-login', 'Bench Customer ' || n,
            'customer', now()
       FROM generate_series(1, 500) n`,
  `INSERT INTO users (id, email, password_hash, full_name, role, updated_at)
     VALUES (gen_random_uuid(), 'bench-admin@acme.test', 'not-a-login', 'Bench Admin', 'admin', now())`,
  // Three accounts share each opened_at instant: the id tiebreaker must keep pages stable.
  `INSERT INTO accounts (id, customer_id, status, collateral_cents, credit_limit_cents, card_last4,
                         card_token, card_expires_on, opened_at, activated_at, updated_at)
     SELECT gen_random_uuid(), u.id, 'ACTIVE', 10000000, 10000000, '4242',
            'tok_' || md5(u.id::text), DATE '2030-01-01',
            now() - ((row_number() OVER (ORDER BY u.email) / 3) * interval '1 hour'), now(), now()
       FROM users u WHERE u.role = 'customer'`,
  // The heavy customer (bench-1): 3,000 purchases, a third of them store orders with lines.
  `INSERT INTO authorizations (id, account_id, amount_cents, captured_cents, status, decline_reason,
                               merchant_name, merchant_mcc, items, created_at, updated_at)
     SELECT gen_random_uuid(), a.id, 1500,
            CASE WHEN n % 4 = 0 THEN 1500 ELSE 0 END,
            (CASE WHEN n % 4 = 0 THEN 'CAPTURED' WHEN n % 4 = 1 THEN 'DECLINED'
                  WHEN n % 4 = 2 THEN 'REVERSED' ELSE 'APPROVED' END)::"AuthorizationStatus",
            (CASE WHEN n % 4 = 1 THEN 'insufficient_funds' END)::"DeclineReason",
            'Corner Grocery', '5411',
            CASE WHEN n % 3 = 0 THEN
              '[{"sku":"APL-1","name":"Apples","quantity":2,"unitCents":"500"},{"sku":"BRD-1","name":"Bread","quantity":1,"unitCents":"500"}]'::jsonb
            ELSE '[]'::jsonb END,
            now() - ((n / 3) * interval '7 seconds'), now()
       FROM generate_series(1, 3000) n
       JOIN accounts a ON a.customer_id = (SELECT id FROM users WHERE email = 'bench-1@acme.test')`,
  `INSERT INTO collateral_deposits (id, account_id, amount_cents, status, limit_ratio_bps,
                                    provider_payment_id, approve_url, created_at, confirmed_at)
     SELECT gen_random_uuid(), a.id, 20000, 'CONFIRMED', 10000, 'pay_' || n, 'http://pay.test/' || n,
            now() - ((n / 2) * interval '11 seconds'), now()
       FROM generate_series(1, 1000) n
       JOIN accounts a ON a.customer_id = (SELECT id FROM users WHERE email = 'bench-1@acme.test')`,
  `INSERT INTO repayments (id, account_id, amount_cents, applied_cents, status, provider_payment_id,
                           approve_url, created_at, confirmed_at)
     SELECT gen_random_uuid(), a.id, 1000, 1000, 'CONFIRMED', 'rep_' || n, 'http://pay.test/r' || n,
            now() - ((n / 2) * interval '13 seconds'), now()
       FROM generate_series(1, 1000) n
       JOIN accounts a ON a.customer_id = (SELECT id FROM users WHERE email = 'bench-1@acme.test')`,
  // Everyone else: 6,000 purchases spread over the other accounts.
  `INSERT INTO authorizations (id, account_id, amount_cents, captured_cents, status, decline_reason,
                               merchant_name, merchant_mcc, created_at, updated_at)
     SELECT gen_random_uuid(), a.id, 900, 0,
            (CASE WHEN n % 5 = 0 THEN 'DECLINED' ELSE 'APPROVED' END)::"AuthorizationStatus",
            (CASE WHEN n % 5 = 0 THEN 'card_frozen' END)::"DeclineReason",
            'City Fuel', '5541', now() - ((n / 3) * interval '5 seconds'), now()
       FROM generate_series(1, 6000) n
       JOIN LATERAL (SELECT id FROM accounts ORDER BY id OFFSET (n % 499) + 1 LIMIT 1) a ON true`,
  // Ledger: 5,000 balanced entries (10,000 postings), 300 of them collateral moves of bench-1.
  `WITH entries AS (
     INSERT INTO journal_entries (id, kind, account_id, description, created_at)
       SELECT gen_random_uuid(),
              (CASE WHEN n <= 150 THEN 'collateral_applied' WHEN n <= 300 THEN 'collateral_released'
                    ELSE 'purchase_capture' END)::"JournalKind",
              CASE WHEN n <= 300 THEN (SELECT a.id FROM accounts a JOIN users u ON u.id = a.customer_id
                                        WHERE u.email = 'bench-1@acme.test')
                   ELSE (SELECT id FROM accounts ORDER BY id OFFSET n % 500 LIMIT 1) END,
              'Bench entry ' || n, now() - ((n / 2) * interval '3 seconds')
         FROM generate_series(1, 5000) n
       RETURNING id)
   INSERT INTO postings (id, entry_id, ledger_account, amount_cents)
     SELECT gen_random_uuid(), id, 'receivable', 100 FROM entries
     UNION ALL
     SELECT gen_random_uuid(), id, 'merchant_settlement', -100 FROM entries`,
  `INSERT INTO audit_log (id, actor_type, actor_id, action, entity_type, entity_id, request_id, data, created_at)
     SELECT gen_random_uuid(), 'system', NULL, 'bench.event', 'account',
            (SELECT id::text FROM accounts ORDER BY id OFFSET n % 500 LIMIT 1), NULL,
            '{}'::jsonb, now() - ((n / 2) * interval '2 seconds')
       FROM generate_series(1, 10000) n`,
  'ANALYZE',
];

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? Number.NaN;
}

async function time(url: string, token: string): Promise<{ p50: number; p95: number }> {
  const once = async () => {
    const started = performance.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    await res.arrayBuffer();
    if (res.status !== 200) throw new Error(`${url} answered ${res.status}`);
    return performance.now() - started;
  };
  for (let i = 0; i < WARMUP; i += 1) await once();
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) samples.push(await once());
  samples.sort((a, b) => a - b);
  return { p50: percentile(samples, 50), p95: percentile(samples, 95) };
}

async function main(): Promise<void> {
  const database = `acme_credit_bench_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: postgresUrl('postgres') });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  try {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      DATABASE_URL: postgresUrl(database),
      JWT_SECRET: randomBytes(32).toString('hex'),
    });
    const migrate = spawnSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      encoding: 'utf8',
      env: process.env,
    });
    if (migrate.status !== 0) throw new Error(`migrate deploy failed:\n${migrate.stderr}`);

    const db = new Client({ connectionString: postgresUrl(database) });
    await db.connect();
    for (const statement of SEED_SQL) await db.query(statement);
    const ids = await db.query<{ customer: string; admin: string; account: string }>(
      `SELECT (SELECT id FROM users WHERE email = 'bench-1@acme.test') AS customer,
              (SELECT id FROM users WHERE email = 'bench-admin@acme.test') AS admin,
              (SELECT a.id FROM accounts a JOIN users u ON u.id = a.customer_id
                WHERE u.email = 'bench-1@acme.test') AS account`,
    );
    const counts = await db.query<{ total: string }>(
      `SELECT (SELECT count(*) FROM authorizations) + (SELECT count(*) FROM collateral_deposits)
            + (SELECT count(*) FROM repayments) + (SELECT count(*) FROM journal_entries)
            + (SELECT count(*) FROM postings) + (SELECT count(*) FROM audit_log)
            + (SELECT count(*) FROM accounts) AS total`,
    );
    await db.end();
    const { customer, admin: adminId, account } = ids.rows[0] ?? {};
    if (!customer || !adminId || !account) throw new Error('bench seed did not create its users');

    const { ThrottlerGuard } = await import('@nestjs/throttler');
    ThrottlerGuard.prototype.canActivate = () => Promise.resolve(true);
    const { AppModule } = await import('../src/app.module');
    const { AccessTokens } = await import('../src/core/auth/access-tokens');
    const { createApi } = await import('../src/core/http/create-api');
    const app = await createApi(AppModule, { CORS_ORIGINS: [] }, { logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    const tokens = app.get(AccessTokens);
    const customerToken = await tokens.issue({ id: customer, role: 'customer' });
    const adminToken = await tokens.issue({ id: adminId, role: 'admin' });

    const firstAuthorization = await fetch(
      `${base}/v1/accounts/${account}/authorizations?pageSize=1`,
      {
        headers: { Authorization: `Bearer ${customerToken}` },
      },
    ).then(async (res) => ((await res.json()) as { items: { id: string }[] }).items[0]?.id);

    const routes: [string, string, string][] = [
      ['customer', 'GET /v1/accounts/me', '/v1/accounts/me'],
      ['customer', 'GET activity (page 1)', `/v1/accounts/${account}/activity?pageSize=10`],
      [
        'customer',
        'GET activity (page 51, OFFSET 500)',
        `/v1/accounts/${account}/activity?page=51&pageSize=10`,
      ],
      ['customer', 'GET authorizations', `/v1/accounts/${account}/authorizations?pageSize=10`],
      [
        'customer',
        'GET authorization detail',
        `/v1/accounts/${account}/authorizations/${firstAuthorization ?? ''}`,
      ],
      ['customer', 'GET deposits', `/v1/accounts/${account}/deposits?pageSize=10`],
      ['customer', 'GET repayments', `/v1/accounts/${account}/repayments?pageSize=10`],
      ['admin', 'GET admin dashboard', '/v1/admin/dashboard'],
      ['admin', 'GET admin accounts', '/v1/admin/accounts?pageSize=10'],
      ['admin', 'GET admin accounts ?status', '/v1/admin/accounts?pageSize=10&status=ACTIVE'],
      ['admin', 'GET admin accounts ?q', '/v1/admin/accounts?pageSize=10&q=customer%2042'],
      ['admin', 'GET admin authorizations', '/v1/admin/authorizations?pageSize=10'],
      [
        'admin',
        'GET admin authorizations ?status',
        '/v1/admin/authorizations?pageSize=10&status=DECLINED',
      ],
      ['admin', 'GET admin account ledger', `/v1/admin/accounts/${account}/ledger?pageSize=10`],
      ['admin', 'GET admin ledger', '/v1/admin/ledger?pageSize=10'],
      ['admin', 'GET admin audit-log', '/v1/admin/audit-log?pageSize=10'],
      [
        'admin',
        'GET admin audit-log ?entityId',
        `/v1/admin/audit-log?pageSize=10&entityId=${account}`,
      ],
    ];
    process.stdout.write(
      `rows seeded: ${counts.rows[0]?.total ?? '?'}; samples per route: ${SAMPLES}\n`,
    );
    process.stdout.write('| Route | p50 ms | p95 ms |\n|---|---|---|\n');
    for (const [who, label, path] of routes) {
      const token = who === 'admin' ? adminToken : customerToken;
      try {
        const { p50, p95 } = await time(`${base}${path}`, token);
        process.stdout.write(`| ${label} | ${p50.toFixed(1)} | ${p95.toFixed(1)} |\n`);
      } catch (error) {
        process.stdout.write(`| ${label} | n/a (${String(error)}) | |\n`);
      }
    }
    await app.close();
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`bench failed: ${String(error)}\n`);
  process.exit(1);
});
