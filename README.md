# acme-credit

The lending service behind Acme Credit's secured credit card: collateral deposit → card
activation → purchase authorization that never exceeds the limit → repayments → collateral
release or application on close. It ships with a customer app and an admin console. The
challenge statement is in [`docs/challenge.md`](docs/challenge.md).

## Quick start

Requirements: Node 24 (`.nvmrc`), Corepack (bundled with Node 24) and Docker. Every command
below runs unchanged in PowerShell and in sh.

```bash
corepack enable
```

```bash
pnpm install
```

```bash
pnpm start
```

`pnpm start` (alias of `pnpm docker:up`) boots the whole project in Docker with one command:
Postgres, object storage, the lending core API (migrated and seeded), its worker, the card
network simulator, the customer app and the admin console. It creates `.env` from
`.env.example` on the first run (random secrets and demo passwords), builds every image and
waits until every service is healthy. If Docker Desktop is closed it opens it and waits for the
engine (Windows, macOS). Later runs reuse the built images and start in seconds; after
changing code run `pnpm docker:rebuild` to rebuild them. `pnpm stop` (`pnpm docker:down`) stops the stack and
keeps the data; `pnpm docker:reset` wipes the volumes and boots again.

| What                             | URL                                   |
| -------------------------------- | ------------------------------------- |
| Customer app                     | http://localhost:4321                 |
| Admin console                    | http://localhost:4322                 |
| Lending core API                 | http://localhost:3000/health          |
| Card network simulator           | http://localhost:3001/health          |
| API documentation (lending core) | http://localhost:3000/docs            |
| API documentation (card network) | http://localhost:3001/docs            |
| Object storage console (RustFS)  | http://localhost:9001/rustfs/console/ |
| Postgres                         | `localhost:5434`                      |

Every port binds to `127.0.0.1` and can be changed in `.env`.

API docs: each backend serves Swagger UI at `/docs` and its OpenAPI 3.1 document at
`/docs/openapi.json`; static copies live in [`docs/api/lending-core.openapi.json`](docs/api/lending-core.openapi.json)
and [`docs/api/card-network.openapi.json`](docs/api/card-network.openapi.json) (refresh with
`pnpm --filter @acme/api openapi:export` and `pnpm --filter @acme/card-network openapi:export`).
The database diagram and its guarantees are in [`docs/database.md`](docs/database.md).

For development with hot reload, run only Postgres and object storage in Docker:

```bash
pnpm infra:up
```

```bash
pnpm --filter @acme/api dev
```

## Architecture

The lending core (`apps/api`) is a **modular monolith** with one Postgres database: every money
operation (deposit confirmation, purchase hold, capture, repayment, close) is ONE ACID
transaction that takes the card account's row lock first, so "a purchase never exceeds the
limit" holds with 50 parallel purchases on one card. Around it, the real outside parties run
as their own processes: the **card network** (merchant store, signed and idempotent
authorizations, delayed capture), the **payment provider** ("Acme Bank": confirms deposits and
repayments by signed webhook, which the core re-reads before crediting) and the **worker**
(transactional outbox relay plus payout, pending-payment and hold-expiry sweeps). Money is
`BIGINT` cents in a double-entry journal that the database refuses to unbalance.

- [`docs/architecture.md`](docs/architecture.md): context and container diagrams, sequence
  diagrams of every money flow, the data model, the critical-service guarantees with the test
  that proves each one, and the failure modes.
- [`docs/thinking-process.md`](docs/thinking-process.md): how the problem was approached, the
  options considered, stack choices, trade-offs, how AI was directed and what the audits
  caught, and known limitations.
- ADRs: [0001 core + satellites](docs/adr/0001-lending-core-plus-satellites.md) ·
  [0002 ledger in cents](docs/adr/0002-double-entry-ledger-integer-cents.md) ·
  [0003 row lock + conditional update](docs/adr/0003-concurrency-row-lock-conditional-update.md) ·
  [0004 idempotency in the same transaction](docs/adr/0004-idempotency-in-the-same-transaction.md) ·
  [0005 object storage](docs/adr/0005-object-storage-rustfs-locally-s3-in-aws.md).
- Deploying to AWS (Terraform): [`docs/deploy.md`](docs/deploy.md).

## Demo walkthrough

The apps speak Spanish (es-MX) by default; labels below are the ones on screen. For English,
press **EN** in the header (or open `/en/`): every screen and error message is translated.

1. **Boot.** `pnpm start` and wait until it reports every service healthy.
2. **Sign in to the wallet.** Open http://localhost:4321 → **Iniciar sesión** → **Usar cuenta
   demo** fills the demo customer (an account with a USD 5,000.00 deposit and some purchase
   history already) → **Iniciar sesión**. To start from zero instead, use **Empezar** and sign
   up with any email.
3. **Deposit collateral.** On a new account the home screen asks for the guarantee deposit
   (USD 200.00 to 10,000.00); on the demo account use **Agregar al depósito** on **Inicio**. Press **Aprobar en Acme Bank (simulador)**: the simulated bank opens in a new tab →
   **Aprobar pago**. Back in the wallet the card turns active (or the limit goes up) once the
   bank's webhook is confirmed; nothing is credited before.
4. **Buy.** **Tienda** → add products → **Pagar {total}**. The card network prices the cart,
   signs the authorization and the core places the hold. Try a cart larger than what is
   available to see a decline with nothing charged.
5. **See the order.** **Actividad** → open the purchase: lines, totals and its timeline (on hold,
   then posted when the network captures it a few seconds later).
6. **Repay.** On **Inicio**, **Hacer un pago** → approve it at Acme Bank → the available credit
   goes back up after the bank confirms.
7. **Freeze.** **Tarjeta** → **Congelar tarjeta**: purchases are now declined as `card_frozen`;
   unfreeze from the same page. (**Perfil** → **Cerrar cuenta** closes the account and returns
   the collateral minus any debt through a payout.)
8. **Admin console.** Open http://localhost:4322 → **Usar cuenta demo** → **Iniciar sesión**.
   The dashboard shows the totals and a zero trial balance. **Compras** lists the purchase you
   just made with its lines; open the account to see its balances, ledger entries (double
   entry, per posting), audit log (who did what, with the request id) and payouts. From there
   an admin can freeze with a reason (the customer cannot lift it), unfreeze, close, or release
   a hold. **Libro mayor** and **Bitácora** show the global journal and audit log.

## Testing

Every check in one command (boots the stack if needed, then lint, typecheck, unit tests with
the coverage gate, integration on real Postgres, script tests, format check and E2E at
1280 / 360 px; it runs every step and prints one summary):

```bash
pnpm test:all
```

`pnpm test:all -- --skip-e2e` leaves out Playwright; `--skip-stack` runs only what needs no
Docker. One scope at a time:

```bash
pnpm test:api
```

```bash
pnpm test:network
```

```bash
pnpm test:web
```

```bash
pnpm test:integration
```

```bash
pnpm e2e:install
```

```bash
pnpm e2e
```

- `test:<scope>` runs lint, format check, typecheck and unit tests (coverage gate 90 %);
  `test:web` covers both web apps and `packages/ui` (`pnpm test:admin` runs the admin alone).
- `test:integration` boots each service and calls it over HTTP. It needs `pnpm infra:up`.
- `e2e` runs Playwright at 1280 px and 360 px against the stack from `pnpm docker:up`.

## Environment

All variables live in `.env` (created from [`.env.example`](.env.example)). Each service
validates what it reads at boot and refuses to start without it.

| Variable                                                     | Used by                 | Meaning                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_PORT`, `NETWORK_PORT`, `WEB_PORT`, `ADMIN_PORT`         | compose, E2E            | Host ports of the four apps                                                                                                                  |
| `POSTGRES_HOST_PORT`, `S3_HOST_PORT`, `S3_CONSOLE_HOST_PORT` | compose                 | Host ports of Postgres and object storage                                                                                                    |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`          | compose, api (F2)       | Local database credentials                                                                                                                   |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`                | compose, api (F5)       | Object storage credentials and bucket                                                                                                        |
| `NODE_ENV`, `LOG_LEVEL`, `PORT`, `CORS_ORIGINS`              | api, card-network       | Runtime mode, log level, listen port, browser origins allowed by CORS                                                                        |
| `HOLD_TTL_HOURS`, `PENDING_PAYMENT_TTL_MINUTES`              | api, worker             | Hold expiry (default 168 h) and bank-approval window of a deposit or repayment (default 30 min), stored on each row at request time          |
| `PUBLIC_API_URL`, `PUBLIC_NETWORK_URL`, `SITE_URL`           | web, admin (build time) | API origins the browser calls; canonical site URL                                                                                            |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                    | api seed                | Admin the seed creates. No default password: `pnpm docker:up` generates one; production refuses a missing, short (< 12) or placeholder value |
| `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`              | api seed                | Demo customer the seed creates (same rules), generated by `pnpm docker:up`                                                                   |
| `SEED_DEMO_CUSTOMER`                                         | api seed                | `true` also creates the demo customer in production; keep `false` there                                                                      |
| `PUBLIC_DEMO_MODE`                                           | web, admin (build time) | Shows the "Usar cuenta demo" fill buttons. Code default `false`; must be `false` in production                                               |
| `PUBLIC_DEMO_EMAIL`, `PUBLIC_DEMO_PASSWORD`                  | web (build time)        | Demo customer the web button fills (public in the bundle); the local `.env` copies the seed values                                           |
| `PUBLIC_DEMO_ADMIN_EMAIL`, `PUBLIC_DEMO_ADMIN_PASSWORD`      | admin (build time)      | Demo admin the admin button fills (public in the bundle); the local `.env` copies the seed values                                            |

## Repository

| Path                      | What                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/api`                | Lending core (NestJS): accounts, collateral, cards, ledger, authorizations, repayments      |
| `apps/card-network`       | Card network and payment provider simulator (NestJS)                                        |
| `apps/web` · `apps/admin` | Customer app and admin console (Astro + React islands, HeroUI v3)                           |
| `packages/contracts`      | Shared API contract (zod schemas, error catalog)                                            |
| `packages/nest-core`      | Shared NestJS core: error envelope, default-deny guard, request id, logging, bootstrap      |
| `packages/ui`             | Shared components, brand tokens, theme script and i18n engine                               |
| `e2e/`                    | Playwright specs                                                                            |
| `infra/`                  | Docker Compose and Dockerfiles; Terraform for AWS (`infra/terraform`, see `docs/deploy.md`) |
| `scripts/`                | Boot scripts behind `pnpm docker:*` (Windows and sh)                                        |
| `docs/`                   | Plan, requirements checklist, ADRs, brand, build prompts                                    |

## How this was built

**Every prompt and every response of the build, in order: [`docs/PROMPTS.md`](docs/PROMPTS.md)**
(index) → [`docs/prompts/01-acme-credit-build.md`](docs/prompts/01-acme-credit-build.md)
(full transcript, with the instructions given to each subagent and their reports).

This project was built with AI coding agents under explicit, non-negotiable rules written
before any code (`CLAUDE.md`: TDD with a mutation check, layered feature structure, strict
DTOs, one error catalog, design tokens only, i18n for every string, and more), composed by
[claude-kit](https://github.com/erfajc97/claude-kit), and a fixed workflow per phase:

1. The plan and the contract first (`docs/plan.md`); every requirement of
   `docs/challenge.md` is a row in `docs/requirements-checklist.md`.
2. A builder agent implements the phase test-first and proves its tests with mutants.
3. Independent, read-only audit agents review it before the commit, at rigor
   `full`: rules, tests, security, ux and challenge after every task; judgment and senior at milestones. Nothing is committed with an open BLOCKER or HIGH.
4. Commit messages say why and what was verified (`git log`).

Decisions that came out of the audits:

- **F0 audit:** the NestJS core (error envelope, default-deny guard, request id, logging,
  bootstrap) was first copied into both services. The rules auditor flagged the duplication,
  and the security and tests auditors found the same two bugs in both copies: a 413 reported
  as a 500, and errors from the body parser losing the request id. The core moved to
  `packages/nest-core`, so each fix and each test now exists once.
- **F0 audit:** nginx dropped every security header, because a `location` with its own
  `add_header` discards the server-level ones. The headers now come from one snippet included
  in each location, and the E2E smoke asserts them.

## Progress (TODO)

Legend: ✅ done · 🔄 in progress · ⬜ pending. Every ✅ passed the audit of the project's
rigor before its commit.

### Setup & planning

- ✅ Requirements analysed: plan (`docs/plan.md`) and compliance matrix (`docs/requirements-checklist.md`)
- ✅ Non-negotiable rules (`CLAUDE.md`) and the kit configuration (`.claude/kit.json`)
- ✅ F0 · Scaffold: pnpm monorepo, tooling, docker-compose (Postgres, object storage), CI, `.env.example`, brand, ADRs
- ✅ F1 · Contract: `packages/contracts` (schemas, error catalog)

### Lending core (apps/api, apps/card-network)

- ✅ F2 · Foundations: money, double-entry ledger, idempotency, locks/retry, audit log, outbox
- ✅ F3 · Auth, accounts, collateral deposit + provider webhook, card activation
- ✅ F4 · Authorizations / capture / reversal, concurrency suite, card-network simulator
- 🔄 F5 · Repayments, freeze, close (release / apply), worker ✅ · statements to object storage ⬜ (R-53)

### Web (apps/web, apps/admin, packages/ui)

- ✅ F6 · Shared UI package + customer app
- ✅ F7 · Admin dashboard

### Delivery

- ✅ F8 · E2E golden paths (1280 / 360)
- ✅ F9 · Terraform (AWS) + deployment guide (`docs/deploy.md`, `infra/terraform/`)
- ✅ F10 · Architecture + thinking-process docs and prompt transcript (`docs/PROMPTS.md`, `docs/prompts/01-acme-credit-build.md`)
- 🔄 F11 · Extras: limit increase ✅ (R-55) · interest + late fees ⬜ (R-54)

### Audit hardening (`docs/audits/2026-10-21-full.md`)

- ✅ H0 · P0 blockers: demo credentials out of code and bundles, golden-path E2E, surviving mutants
- ✅ H1 · Security HIGHs (token masking, signed Idempotency-Key, `returnTo`, void ownership)
- ✅ H2 · Domain HIGHs (hold expiry, payouts sweep, repayment expiry, idempotency lease, `frozenBy`, deposit cap, seed)
- ✅ H3 · Admin and wallet UI for H2, mascot "Credi", brand splash, product tours, favicons, link previews
- 🔄 H4 · Rules findings: format ✅ · unused exports, helpers layout, ADR-0002 refresh ⬜
- Decision (G11, owner) · Total collateral per account capped at USD 10,000.00 (the single-deposit max)
- Decision (G11, owner) · Admin freeze reasons `admin_review` (default) · `suspected_fraud` · `collections`; holds expire after 168 h (`HOLD_TTL_HOURS`), unapproved deposits/repayments after 30 min (`PENDING_PAYMENT_TTL_MINUTES`); a payout is retried up to 5 attempts (30 s → 1 h backoff)
