# Thinking process

How the problem was approached, which choices were made and why, what was traded away, and
how AI was directed (R-13, R-11). The system itself is described in
[`architecture.md`](architecture.md); each big decision has an ADR in [`adr/`](adr/).

## 1. Reading the statement

The statement ([`challenge.md`](challenge.md)) was copied into the repository verbatim and each
requirement got an ID (`R-01 … R-18`; our own extras are `R-50+`). Every ID became a row in
[`requirements-checklist.md`](requirements-checklist.md), which the challenge auditor checks
against code and tests rather than against claims.

Three sentences shaped everything else:

- **"A purchase must never exceed the limit."** This is the one invariant that, if broken, is
  a loss for the company. It has to hold with two purchases on the same card at the same
  instant, with retries, and with repayments and closes racing against it.
- **"Money is moving, and part of it is held as a guarantee, so this is a critical
  service."** So money must be exact (no float), explainable (every movement traceable),
  and confirmed by the party that actually moved it (the bank), not by the client.
- **"We value quality over quantity."** So the core flows (R-01 … R-05) are built to a
  production standard before any extra, and extras (interest, statements) wait if time runs
  out.

The critical part, then, is not the CRUD around accounts. It is one small aggregate (a card
account, its collateral and its ledger) that many writers touch, with two untrusted outside
parties (the card network and the bank) that retry, duplicate and time out.

## 2. Architecture options (ADR-0001)

The statement recommends a microservice and allows other styles if they fit better. Three
options were written down before any code:

| Option | What it is | Verdict |
| --- | --- | --- |
| **A.** One microservice per domain (collateral, cards, ledger, payments) | Textbook answer: independent deploys and scaling. | Rejected. The limit check, the hold and the ledger posting would sit in different databases. "Never over the limit" would need a saga with compensations or 2PC, and a crash between "hold placed" and "posting written" leaves money in limbo until a compensator runs. Every consistency bug becomes a distributed-systems bug, for a load that has no scaling need. |
| **B.** Lending core as a modular monolith with one Postgres, plus satellite services | One ACID transaction and one row lock per money operation; hard module boundaries in code; the real external parties as separate processes. | **Chosen.** |
| **C.** A single process including the network simulator | Simplest. | Rejected: it hides the exact problems the challenge wants handled (retries, duplicate requests, signatures, timeouts between systems). |

### Why a modular-monolith core with satellites, not full microservices

A microservice boundary is worth its cost when the two sides change, scale or fail
independently. Here, every money flow (deposit, activation, authorization, capture,
repayment, close) reads and writes the same three things: the account row, its collateral and
its journal. Splitting them buys independent deploys of pieces that can never be correct
independently, and pays for it with sagas on the hottest, most sensitive path.

The boundaries that ARE real were made real:

- **The card network** is a separate NestJS service. It calls the core over HTTP with
  HMAC-signed, idempotent requests, retries 5xx with the same key, captures later and can
  void. This is where duplicates and timeouts come from in real life, so they are exercised
  for real.
- **The payment provider** (the customer's bank) confirms money by signed webhook, and the
  core always re-reads the payment at the provider before crediting anything.
- **The worker** is a second entrypoint of the core codebase in its own container: it relays
  the transactional outbox and runs the sweeps (pending payments, payouts, expired holds), so
  no external side effect ever runs inside a money transaction.

Inside the core, modules (`accounts`, `payments`, `authorizations`, `payouts`, `admin`,
`auth`) keep hard boundaries: `core/` never imports a module, and modules talk through
services, not repositories (rule AN1, checked by the architecture check). That keeps the
extraction path open (section 5).

## 3. Strategy for the critical parts

| Concern | Strategy | Alternatives considered |
| --- | --- | --- |
| Never over the limit (ADR-0003) | `SELECT … FOR UPDATE` on the account row as the first statement, a conditional update for the hold (`… WHERE limit - held - debt >= amount`, row count checked), and a DB `CHECK (held + posted_debt <= credit_limit)` as the last line. One lock order, `lock_timeout = 3s`, one retry helper. | Optimistic versioning: a 50-purchase burst turns into retry storms and spurious 409s. `SERIALIZABLE` everywhere: retries everywhere, and reasoning about what is safe gets harder. Contention per card is one human, so a short pessimistic lock costs nothing and is easy to prove. |
| Exact, explainable money (ADR-0002) | Double-entry journal whose postings must sum to zero, enforced in the domain AND by a deferred constraint trigger at commit; append-only. Cached balances on the account updated in the same transaction. | Mutable balances only: no history, a bug silently corrupts a balance. |
| Retries never repeat an effect (ADR-0004) | The idempotency key, a hash of the request and the stored response commit in the same transaction as the effect. Later amended with a 60 s lease so a crashed request does not lock its key forever. | A Redis cache of keys: the key and the effect commit separately, so a crash either repeats the effect or loses the answer, and it adds Redis. |
| Trust the bank, not the client (MO4) | Webhooks carry only "look again"; the core re-reads by OUR reference and checks reference, amount and purpose. A timeout is "unknown", never "failed": sweeps ask again and settle late approvals through the same code. | Trusting the webhook body or a client-sent payment id: a made-up id would credit real money. |
| Decisions recorded at request time (MO5) | Limit ratio, hold expiry and payment expiry are stored on the row when it is created and read from there. | Recomputing from today's settings: a policy change would alter money already promised. |

## 4. Stack choices

| Choice | Why | Rejected / noted |
| --- | --- | --- |
| **TypeScript everywhere**, Node 24, pnpm workspaces | The statement suggests Python, TypeScript or Go. One language lets the API contract (`packages/contracts`, zod) be shared by the core, the network and both web apps, so a field cap or a money parser exists once. | Go would be a fine core; it would duplicate the contract in two languages. |
| **NestJS 11** | Modules map one-to-one onto the domain modules; guards, pipes and filters give one place for default-deny access, validation and the error envelope (shared through `packages/nest-core`). | Express/Fastify alone: those cross-cutting pieces would be hand-rolled per service. |
| **Prisma 7** + hand-written SQL migrations | Typed queries and `select` allowlists; tagged `$queryRaw` for the lock and the conditional update. Migrations are reviewed SQL so CHECKs, the partial unique index and the triggers live in them, with a drift test. | `migrate dev` / `db push` are forbidden: they hang without a TTY and propose dropping what only exists in SQL. |
| **PostgreSQL** | Row locks, `SKIP LOCKED`, CHECK constraints, deferred constraint triggers, `BIGINT`: every guarantee above is a Postgres feature. The statement allows in-memory, but an in-memory store cannot prove a lock or a constraint. | SQLite: no `FOR UPDATE`, no deferred triggers. |
| **`BIGINT` cents, not `Decimal`** (project rule P1) | One currency at cent precision. Integer arithmetic is exact and native (`bigint` in TS and Postgres); JSON carries strings of digits. One parser rejects a third decimal, signs and exponents. | `Decimal(p, s)` (the kit default) is decimal.js in Prisma: easy to drop into `Number` by accident, and scale-2 arithmetic still needs explicit rounding. |
| **Transactional outbox, not a queue** (project rule P2) | An event must exist if and only if its change committed. The outbox row is written in the same transaction; the worker claims with `FOR UPDATE SKIP LOCKED` and a lease. No Redis to run. | BullMQ/Redis publish from the request: a crash after commit and before publish loses the event; publish before commit creates phantom events. |
| **HMAC between services** (project rule P3) | HMAC-SHA256 over `timestamp.method.path.idempotencyKey.body`, verified on the raw bytes before parsing, ±5 min skew. The key is signed so a captured request cannot be replayed as a new effect under a fresh key (an audit finding). | mTLS would also work in production; HMAC is portable and testable without a PKI. |
| **Astro with React islands + TanStack Query** | Most of both apps is static shell; interactivity is islands. TanStack Query is the only home for server state (one cache, invalidation by exported keys). | A full SPA ships more JS for the same screens. |
| **HeroUI v3 + Tailwind v4** in `packages/ui` | Accessible react-aria primitives, themed from brand tokens ([`brand.md`](brand.md)); one component library for the wallet and the console. | |
| **RustFS locally, S3 in AWS** (ADR-0005) | MinIO stopped publishing community images during F0; RustFS is S3-compatible, Apache-2.0 and pulls. Code only knows the S3 SDK, so AWS is a config change. | Building MinIO from source (AGPL, fragile); SeaweedFS (heavier configuration). |
| **Simulated identity** (argon2 + JWT, httpOnly rotating refresh cookie) | The statement allows simulated auth; the seams (audiences, roles, refresh rotation with family revocation) match a real OIDC provider. | |

## 5. Trade-offs accepted, and what changes at scale

Accepted on purpose:

- **The core scales as one unit.** Load is per card and small; vertical scaling plus read
  replicas cover it for a long time. One team owns the core.
- **A lock is held for the length of a money transaction.** Transactions stay short and
  never call a third party; provider calls happen between transactions or in the worker.
- **The hold is a cached balance, not a journal posting.** Money moves (and the journal is
  written) at capture; the hold is a reservation protected by the lock and the CHECK.
- **The provider simulator lives inside the card-network process.** It is a separate
  boundary in code and in contract, just not a separate container.
- **One currency, no fractions of a cent.**

What would change at a much larger scale:

1. **Extract along the existing seams, outbox first.** Payouts, statements and notifications
   already run off the outbox and move out first. The ledger moves last, and only behind an
   append-only API that keeps the per-account lock in the core.
2. **An event bus behind the outbox.** The relay publishes to Kafka/SNS+SQS instead of calling
   handlers in-process; the outbox keeps the "exists iff committed" guarantee.
3. **Read replicas** for the admin console, activity lists and the ledger explorer (all
   keyset-paginated already); writes stay on the primary.
4. **Card tokenization and PCI scope.** Today the card is an opaque token plus last 4. A real
   card needs a vault/tokenization service (or the processor's tokens) so PANs never enter the
   core, which shrinks PCI scope to the vault.
5. **A real IdP** (OIDC, MFA for admins), a least-privilege DB role for the app, an
   append-only trigger on the audit log, and a scheduled reconciliation job (cached balances
   vs. journal, `cash_clearing` vs. the bank's statement).

## 6. How AI was used

Every prompt and response is exported in order in [`PROMPTS.md`](PROMPTS.md) (R-12). The
approach follows the statement's advice (R-11): **the AI was told what to do, not asked how to
think.** The owner made the architecture and policy decisions (ADRs, the `(proposal)` items
in the README); agents built and audited within those decisions.

### The harness

- **Rules first.** Before any code, [`CLAUDE.md`](../CLAUDE.md) was composed by claude-kit:
  numbered, checkable rules (general `G`, API `A`, NestJS `AN`, web `W`/`WA`, money `MO`,
  observability `OB`) plus the project's own `P1–P3`. Each rule says why it exists and how an
  auditor checks it. Reviews and commits cite rule IDs.
- **Plan and contract first.** [`plan.md`](plan.md) lists phases with acceptance criteria tied
  to requirement IDs; `packages/contracts` fixed the API before the builders started.
- **TDD with mutation testing.** Builder agents (`kit-nestjs:api-builder`,
  `kit-astro:web-builder`, `kit-astro:qa-e2e`) write the failing test first, then the code,
  then break each new rule on purpose (invert a comparison, drop a guard, skip the
  transaction) with the in-memory mutant recipe (`.claude/kit/mutant/`). A surviving mutant
  means the test is fixed. Commits report `Mutation: N/N killed`.
- **Independent, read-only audits before every commit** (rigor `full`): rules, tests,
  security, UX and challenge after every task; judgment (domain decisions) and senior
  (staff-level advisory) at milestones. Nothing is committed with an open BLOCKER or HIGH.
  The builder never audits itself.
- **Lessons become rules.** A defect found twice becomes an entry in
  [`quality-standard.md`](quality-standard.md) and, if mechanical, a census script or a
  structure check.

### What the audits caught

The F0 audit found the NestJS core copied into both services with the same two bugs in each
(a 413 reported as 500, body-parser errors losing the request id) and nginx dropping every
security header; the core moved to `packages/nest-core` and the headers to one included
snippet.

The full audit of 2026-10-21 ([`audits/2026-10-21-full.md`](audits/2026-10-21-full.md))
returned **FAIL: 4 BLOCKERs and more than 15 HIGHs**. In summary:

| Area | Most important findings |
| --- | --- |
| Security | Demo and admin passwords baked into client bundles and seeded in production (BLOCKER); admin responses leaking the full card token; a customer able to lift an admin freeze; an open redirect in `returnTo`; the `Idempotency-Key` not covered by the HMAC. |
| Tests | No golden-path E2E (BLOCKER); two surviving mutants in money rules: an order one cent under its lines, and a checkout replay with another quantity (BLOCKERs); an outbox test that passed or failed depending on file order; a trial-balance assertion that could not fail. |
| Domain (judgment) | Holds that never expire; payouts not retried or visible; PENDING repayments blocking forever; a crashed request locking its idempotency key forever; no cap on total collateral per account. |
| Rules / challenge | Formatting, unused exports, English copy sent by the API, stale ADR-0001, missing architecture docs and demo steps. |

The fixes, each with its own regression test written red first:

- `d1153f9` — demo credentials out of code and bundles: demo buttons read build-time public
  env only (off by default), the seed refuses missing, short or placeholder passwords and
  skips the demo customer in production; `pnpm start` generates them.
- `0bbb09d` — golden-path E2E for the customer and the admin at 1280 and 360 px. It surfaced
  a real bug (wallet balances stale after a hold posted), fixed in the wallet.
- `ee9accd` — the two surviving mutants killed with unit and integration cases (4/4 killed).
- `9b061cd` — outbox integration tests no longer depend on spec-file order.
- `2e24066`, `b2979ac`, `4b6e704` — structured activity (no English text for clients to
  parse), keyset pagination and the order detail, from rules and senior findings.
- Hardening H1/H2 (`1ae6c3c`, then admin and wallet UI for it in `df91153`, `51a3cf5`):
  idempotency lease (ADR-0004 amendment), `frozenBy`, collateral cap per account, hold
  expiry sweep and admin release, payouts swept and retried, PENDING repayment expiry after a
  provider re-read, the key inside the HMAC, card token masked in admin answers.

## 7. Known limitations and next steps

Honest list, as of this writing:

- **Not built yet:** monthly statements to object storage (R-53) and interest and late fees
  (R-54). The storage is in the stack; the statement job is not.
- **Reconciliation:** cached balances are updated with the journal in one transaction, but
  there is no scheduled job yet that recomputes them from the journal and alerts on drift, and
  `cash_clearing` is not reconciled against a bank statement. `merchant_settlement` is never
  paid out to merchants (no clearing file).
- **Debt after close:** debt the collateral cannot cover stays as a receivable on the closed
  account; there is no collections flow.
- **Security hardening still open from the audit (P2/advisory):** a least-privilege DB role,
  an append-only trigger on the audit log, separate refresh cookies for admin and customer,
  stricter throttles on money routes, trusted-proxy configuration.
- **Performance:** the senior audit measured p95 around 3 s at 24 parallel requests on a
  laptop; the DB pool and round trips per request need tuning before load. One client chunk
  is around 700 kB.
- **Simulations:** the identity provider, the card network and the bank are simulated. Card
  data is a token plus last 4, not a PAN; PCI is out of scope.
- **Cloud:** Terraform for AWS and the deploy guide live in [`deploy.md`](deploy.md); nothing
  is deployed live.
