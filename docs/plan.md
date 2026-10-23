# acme-credit — execution plan

> Source of truth for scope: `docs/challenge.md`.
> Compliance matrix (what `auditor-challenge` checks): `docs/requirements-checklist.md`.
> How code is written (non-negotiable rules): `CLAUDE.md`.
> Progress lives in the "Progress (TODO)" list of `README.md`, ticked at the end of every
> phase (G8).

## 1. Goal

Ship, by 2026-10-26, the service that owns Acme Credit's secured credit card: collateral
deposit and confirmation → card activation with a limit derived from the deposit → purchase
authorization that can never exceed the limit (also under concurrency) → repayments → collateral
release or application on close. Plus a customer app and an admin dashboard, Docker Compose to
run it all locally, Terraform for AWS, and the docs the statement asks for (architecture
reasoning, thinking process, `docs/PROMPTS.md`). "Done" = every MUST row of the checklist ✅ with
evidence and the golden-path E2E green.

## 2. Repository layout

```
acme-credit/
├── apps/api/             # api · nestjs — lending-core: accounts, collateral, cards, ledger,
│                         #   authorizations, repayments, closure, auth, admin. Also the
│                         #   outbox worker (second entrypoint, own container).
├── apps/card-network/    # api · nestjs — simulated card network + collateral payment provider
├── apps/web/             # web · astro — customer app (deposit, card, purchases, repay, close)
├── apps/admin/           # web · astro — admin dashboard with its own login
├── packages/contracts/   # zod schemas + TS types shared by every app (the API contract)
├── packages/ui/          # HeroUI v3 wrappers + Tailwind v4 theme built from docs/brand.md tokens
├── packages/nest-core/   # shared NestJS core: envelope, default-deny guard, request id, logging, bootstrap
├── e2e/                  # Playwright (1280 / 360)
├── infra/                # docker-compose.yml, Dockerfiles, nginx; terraform/ (AWS) in F9
├── scripts/              # up.mjs → up.ps1 / up.sh behind `pnpm docker:*` (G20)
└── docs/                 # plan, checklist, ADRs, architecture, thinking process, PROMPTS.md
```

## 3. Contract

Contract-first: `packages/contracts` holds every schema below; API, network and both web apps
import it. Amounts travel as **strings of integer cents** (`"12550"` = USD 125.50), never
numbers.

### Errors — one envelope for every non-2xx

`{ "code": "<catalog code>", "message": "…", "details": {}, "requestId": "…" }`

### Endpoints (core, prefix `/v1`)

| Method | Path | Auth | Request | Response | Status codes |
|---|---|---|---|---|---|
| POST | /auth/login | public | email, password, audience (`customer`/`admin`) | access token (httpOnly cookie) + profile | 200, 401, 429 |
| POST | /auth/logout | any | — | — | 204 |
| GET | /me | customer | — | profile + account summary | 200, 401 |
| POST | /accounts | customer | Idempotency-Key | account `PENDING_COLLATERAL` | 201, 409 |
| POST | /accounts/:id/collateral-deposits | customer | Idempotency-Key, amount | deposit `PENDING` + provider payment reference/instructions | 201, 404, 409, 422 |
| POST | /webhooks/payments | HMAC (provider) | provider event (reference) | — (re-reads provider state, confirms deposit, activates card) | 204, 401, 409 |
| GET | /accounts/:id | owner/admin | — | balances (limit, available, held, posted debt), status | 200, 404 |
| GET | /accounts/:id/transactions | owner/admin | cursor | ledger-backed activity | 200, 404 |
| POST | /network/authorizations | HMAC (network) | Idempotency-Key, card token, amount, merchant | APPROVED / DECLINED (+reason) | 201, 401, 409 |
| POST | /network/authorizations/:id/capture | HMAC (network) | Idempotency-Key, amount ≤ authorized | capture | 201, 404, 409, 422 |
| POST | /network/authorizations/:id/reversal | HMAC (network) | Idempotency-Key | reversal | 201, 404, 409 |
| POST | /accounts/:id/repayments | owner | Idempotency-Key, amount | repayment `PENDING` → confirmed via provider webhook | 201, 404, 409, 422 |
| POST | /accounts/:id/freeze · /unfreeze | owner/admin | Idempotency-Key | status | 200, 404, 409 |
| POST | /accounts/:id/close | owner/admin | Idempotency-Key | settlement (released / applied / refunded amounts) | 200, 404, 409 |
| GET | /admin/accounts · /admin/ledger · /admin/audit-log · /admin/authorizations | admin | filters, cursor | lists | 200, 401, 403 |

Card network (`apps/card-network`): `POST /purchases` (from the customer app: card, merchant,
amount, Idempotency-Key) → signs and forwards to core, simulates retries/timeouts; payment
provider: `POST /payments` (deposits/repayments), `GET /payments/:ref`, sends signed webhooks.

### Validation decisions

| Field / rule | Decision | Layer | Why |
|---|---|---|---|
| amount | integer cents as string, `1 … 1_000_000_00` | DTO + DB check | no floats; cap bounds the blast radius |
| collateral | min USD 200, max USD 10,000 | service (policy row) | realistic secured-card range |
| credit limit | = confirmed collateral × policy ratio (100 %), stored on the deposit | service | MO5: recorded at request time |
| purchase | approved only if `amount ≤ available` and account `ACTIVE` | service under row lock + conditional update | R-03 never over limit |
| capture | `≤ authorized amount`; hold released for the difference | service | partial captures happen |
| repayment | `≤ outstanding debt` (no credit balances) | service | keeps close logic simple |
| close | blocked with pending holds; debt → collateral applied first | service | R-05 |
| Idempotency-Key | required UUID on every money POST; same key + other payload → 409 | DTO + table | MO2 |

## 4. Key decisions

1. **Lending-core as a modular monolith + satellite services** — the limit check, the hold and
   the ledger posting must commit in ONE ACID transaction; splitting cards from ledger would put
   sagas and compensations on the money path. Satellites are real boundaries: the card network
   and payment provider (external trust boundary, retries, signatures) and the outbox worker
   (async side effects). ADR-0001.
2. **Double-entry ledger with integer cents** — every movement is a balanced journal entry;
   cached balances are updated in the same transaction and reconciled per account against the
   journal (dashboard + worker job, R-08c). Instead of
   mutable balance columns only. ADR-0002.
3. **Pessimistic row lock + conditional update** for authorizations, instead of optimistic
   versioning alone — contention per card is low, correctness matters more than throughput.
   ADR-0003.
4. **Idempotency table written in the same transaction as the effect**, instead of a cache —
   a replay after a crash must not double-charge. ADR-0004.
5. **Postgres for everything transactional, object storage for documents** (statements, exports; RustFS locally, S3 in AWS — ADR-0005) —
   S3-compatible so the AWS story is a config change.
6. **Transactional outbox** for events, instead of publishing from the request — no lost or
   phantom events.
7. **Simulated IdP** (argon2 + JWT in httpOnly cookie, roles customer/admin) — the statement
   allows simulated auth; the seams match a real OIDC provider.
8. **Two Astro apps sharing `packages/ui` and brand tokens** — separate deploy and attack surface
   for admin, one design system.

9. **One shared NestJS core (`packages/nest-core`)** — the error envelope, default-deny guard,
   request id, logging and bootstrap are identical for every service and security-sensitive, so
   they live once and are tested once, instead of a copy per service (F0 audit, G12).
10. **Content-Security-Policy from Astro + headers from nginx** — Astro's `security.csp` hashes
    every script and style it emits (plus the inline theme script by explicit hash); nginx adds
    `frame-ancestors`, `X-Frame-Options` and the rest through one snippet included in every
    location.

## 5. Phases

Each phase = builder → audit at the project's rigor (G6) → fixes → commit → README TODO
tick.

| # | Phase | Owner agent | Requirements | Depends on | Parallel with |
|---|---|---|---|---|---|
| F0 | Scaffold: pnpm monorepo, shared Nest core, tooling, docker-compose (Postgres, object storage), boot scripts, CI, `.env.example`, brand, ADRs 1–5, E2E smoke | main | R-07, R-09, R-12 (index), R-17 | — | — |
| F1 | Contract: `packages/contracts` (schemas, error catalog) | main | R-08 | F0 | — |
| F2 | Core foundations: money type, ledger, idempotency, lock/retry helpers, audit log, outbox | kit-nestjs:api-builder | R-06, R-08a–f | F1 | F6 (ui package) |
| F3 | Auth + accounts + collateral deposit + provider webhook + activation | kit-nestjs:api-builder | R-01, R-02, R-08b | F2 | F6 |
| F4 | Authorizations / capture / reversal + concurrency suite; card-network service | kit-nestjs:api-builder | R-03, R-08a | F3 | F6 |
| F5 | Repayments, freeze, close (release / apply); worker + statements to object storage | kit-nestjs:api-builder | R-04, R-05, R-52, R-53 | F4 | F7 |
| F6 | `packages/ui` + customer app | kit-astro:web-builder | R-50, R-51 | F1 | F2–F4 |
| F7 | Admin app | kit-astro:web-builder | R-50, R-51 | F6 | F5 |
| F8 | E2E golden paths (1280 / 360) | kit-astro:qa-e2e | R-01–R-05, R-51 | F5, F7 | — |
| F9 | Terraform AWS + deploy doc | main | R-10 | F0 | F6–F8 |
| F10 | Docs (architecture, thinking process, README), PROMPTS.md export, final full audit + milestone | main | R-07, R-12, R-13, R-15, R-18 | all | — |
| F11 | Extras if time: interest + late fees, limit increase | kit-nestjs:api-builder | R-54, R-55 | F5 | — |
| H | Audit hardening: P0 blockers, security and domain HIGHs, admin UI for them, rules findings | api-builder, web-builder, qa-e2e | R-06, R-08a–f, R-18 | F8 | F9 |

### Acceptance criteria per phase

#### F0 · Scaffold

- [x] `pnpm docker:up` boots every service from a clean clone and waits for health (creates `.env`).
- [x] Every service answers `/health`; unknown routes answer the error envelope with the request id.
- [x] Unmarked routes are denied (403) and a route-marker scan fails on 0 or 2 markers.
- [x] Body-parser errors keep the request id; a body over 1 MB answers 413 with its code, not 500.
- [x] CORS answers only the allowlist; a global rate limit answers 429 with its code.
- [x] Static sites send CSP, `X-Frame-Options`, `nosniff` and `Referrer-Policy` on every path.
- [x] Both web apps follow the system dark preference before paint; HeroUI variables map to brand tokens.

#### F2 · Core foundations

- [x] A journal entry whose postings do not sum to zero is rejected (domain and DB) — `ledger.spec.ts` "refuses one cent off", `platform.int-spec.ts` trigger test.
- [x] Money helpers never use floats; parsing `"0.1"`-style input fails; cents round-trip — `money.spec.ts` (api, contracts).
- [x] Same Idempotency-Key + same payload → identical stored response, one effect; other payload → 409 — `idempotency.spec.ts`, `authorizations.int-spec.ts`.
- [x] Serialization failure is retried by the single helper; giving up → 409 `operation.in_progress` — `database.spec.ts`.
- [x] Every state change writes an audit row and an outbox row in the same transaction — `ledger.spec.ts` "recordChange…", `settlement.int-spec.ts`.

#### F3 · Collateral and activation

- [x] Card is not usable until the provider confirms the deposit (webhook re-reads provider) — `lending.int-spec.ts` "keeps the card unusable until the provider confirms…".
- [x] Forged webhook (bad HMAC) → 401, no state change; unknown reference → 4xx — `lending.int-spec.ts` "refuses a forged webhook (401) and an unknown reference (404)".
- [x] Limit = confirmed amount × ratio stored on the deposit; ledger shows collateral liability — `lending.int-spec.ts` (MO5 test).
- [x] Customer A cannot read or act on customer B's account (404) — `lending.int-spec.ts` "ownership (A14)", `pagination.int-spec.ts` detail 404.

#### F4 · Spending

- [x] Purchase of exactly `available` approved; `available + 1` cent declined (boundary pair) — `authorizations.int-spec.ts:72`, `authorizations.service.spec.ts`.
- [x] 50 parallel purchases on one card: total approved ≤ limit, available never negative — `authorizations.int-spec.ts:90`.
- [x] Frozen / pending / closed account → declined with reason — `authorizations.int-spec.ts:109`, `settlement.int-spec.ts` close test.
- [x] Network retry with same key → same decision, single hold — `authorizations.int-spec.ts:127`, card-network `purchases.int-spec.ts:139`, `checkout.int-spec.ts` (quantity fingerprint, `ee9accd`).

#### F5 · Repayment and close

- [x] Repayment restores available credit only after provider confirmation — `settlement.int-spec.ts:44`.
- [x] Close in good standing releases full collateral; with debt applies collateral and refunds the rest — `settlement.int-spec.ts`.
- [x] Close with pending holds → 409 — `settlement.int-spec.ts` "refuses to close with purchases on hold".
- [x] Ledger trial balance is zero after every scenario, and cached balances reconcile per account with the journal — `reconciliation.int-spec.ts` (a corrupted balance is detected).

#### F6–F8 · Apps and E2E

- [x] Customer: deposit → active card → buy → over-limit decline → repay → close, at 360 and 1280 px — `e2e/specs/customer-golden-path.spec.ts` (`0bbb09d`), `pnpm e2e` 16/16.
- [x] Admin: login, see the purchase, ledger and audit entries for it — `e2e/specs/admin-golden-path.spec.ts`.
- [x] Every list paginated by cursor; order detail; navigation same-document — `pagination.int-spec.ts`, web `Activity.spec`, admin `useInfiniteList.spec` (`2e24066`, `b2979ac`, `4b6e704`).

#### H · Audit hardening (2026-10-22, from `docs/audits/2026-10-21-full.md`)

- [x] H0 · P0 blockers: demo credentials out of code and bundles, seed guarded in production (`d1153f9`); golden-path E2E (`0bbb09d`); surviving mutants killed (`ee9accd`).
- [x] H1 · Security HIGHs: admin responses mask the card token; Idempotency-Key covered by the HMAC signature; `returnTo` validated by origin; void requires the owner; refresh cookie Secure in production.
- [x] H2 · Domain HIGHs: hold expiry sweep + admin release; payouts swept, retried and listed; PENDING repayments expire after a provider re-read; idempotency lease; `frozenBy` (customer cannot lift an admin freeze); deposit cap per account (proposal: USD 10,000.00 total); realistic seed; reconciliation assertion.
- [x] H3 · Admin UI for H2: payouts list, release a hold, freeze origin; wallet explains an admin freeze and the deposit cap.
- [ ] H4 · Rules and challenge findings: prettier on the whole repo ✅ (`12dd2ba`), unused exports, mappers into `helpers/`, ADR-0001 refresh, README architecture and demo steps, `kit.json` `locale.ui` → `es-MX`.

### Audit loop (every phase)

```
builder (TDD: red → green → refactor, mutation check on new rules)
  → /kit:audit            (the chain of the project's rigor — blocking)
  → fixes by the builder → re-audit only what failed
  → /kit:phase-done       (commit message, progress tick)
  → commit (main agent)
milestones: auditor-judgment + auditor-senior
```

Milestones: after F5 (core complete) and after F10 (delivery).

## 6. Definition of done (whole project)

- Every row of `docs/requirements-checklist.md` is ✅ with evidence.
- All commands of `.claude/kit.json` green; E2E of the golden paths green.
- README: install, run, env, tests, decisions, "How this was built", Progress all current.
- `docs/PROMPTS.md` indexes, in order, the verbatim session transcripts in `docs/prompts/`
  (every prompt and every response).

## 7. Operational notes

- **Toolchain:** Node 24 (`.nvmrc`), pnpm 12.14 via corepack (`packageManager`), TypeScript 6.0
  (typescript-eslint and `astro check` do not support TS 7 yet), ESLint 9 (`eslint-plugin-react`
  and `jsx-a11y` do not support 10 yet), NestJS 11 (nestjs-zod does not support 12 yet),
  Prisma 7.10 (8 is still an RC).
- **Boot order** (`pnpm docker:up`, which waits for every healthcheck): postgres, object-storage → object-storage-init (bucket) → api
  (migrations + seed from F2) → worker (F5), card-network → web, admin.
- **Ports:** api 3000, card-network 3001, web 4321, admin 4322, postgres **5434** on the host
  (`POSTGRES_HOST_PORT`; 5432 is often taken by a local install, and Docker Desktop on the
  author's machine held 5433 after a container was removed), object storage 9000 and
  console 9001.
- **Dev servers:** `pnpm infra:up` starts only Postgres and object storage, so the apps can run
  with `pnpm --filter <pkg> dev`.
- **Corepack:** `~/package.json` on the author's machine pins yarn through `packageManager`. The
  repo root sets its own `packageManager`, so corepack picks pnpm inside the repo.
- **pnpm 12** only runs install scripts listed in `allowBuilds` (`pnpm-workspace.yaml`), and
  refuses releases younger than its minimum age unless they are in `minimumReleaseAgeExclude`.

## 8. Status (2026-10-22)

Done: F0–F10 (core, both apps, golden-path E2E, Terraform + deploy guide, architecture and
thinking-process docs, PROMPTS export), R-55, H0–H3 (audit blockers and HIGHs, admin/wallet UI
for them), mascot, splash, product tours, favicons, link previews, `pnpm start` / `pnpm stop` /
`pnpm test:all`.
Left: H4 rest (unused exports, mappers into `helpers/`, ADR-0002 chart of accounts), R-53
statements, R-54 interest and fees, GitHub remote (R-15).
