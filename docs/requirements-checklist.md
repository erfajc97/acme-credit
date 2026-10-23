# Requirements checklist — acme-credit

Every row is a literal requirement extracted from `docs/challenge.md`. If this file
and the source disagree, **the source wins** and this file is corrected.

`auditor-challenge` marks each row with **hard evidence**: `file:line`, the name of the
test that asserts it, or a command and its output (with the stack running, `curl` against
the real endpoints). **Nothing is ✅ from memory.** The main agent copies that evidence here
when a task closes (G8).

**Legend:** **[MUST]** explicit requirement · **[SHOULD]** "desirable" / valued ·
**[OPT]** optional extra.
**Status:** ✅ verified · ⚠️ met with a caveat (what is missing) · ❌ missing · ⏳ not yet
audited.

**Literal reading:** status codes, field and parameter names, units and numbers, "by
organization", "with confirmation", "configurable from …" (the screen must exist, not only
the table), "in the background with a notice", "from 360 px". Performance figures are
**measured** (p50/p95 of ≥ 20 runs) or marked ⚠️ "not measured".

**Last update:** 2026-10-22 · MUST ✅ 18/18 · SHOULD ✅ 5/5 · OPT ✅ 4/7 (R-53, R-54 and R-16 are optional ideas, not built) · final challenge audit: `auditor-challenge` 2026-10-22.

## A. Lending flow (Problem Statement)

| ID | Requirement (literal, shortened) | Status | Evidence |
|---|---|---|---|
| R-01 | [MUST] Collateral deposit: receive and confirm the customer's guarantee deposit | ✅ | Deposit through the simulated provider, confirmed only by a signed webhook that re-reads the provider: `lending.int-spec.ts` "keeps the card unusable until the provider confirms…", "never credits a provider payment whose amount is not ours"; E2E `customer-golden-path.spec.ts` (bank tab approve). |
| R-02 | [MUST] Card active only once its collateral is confirmed, credit limit derived from the deposit | ✅ | `lending.int-spec.ts` "activates with limit = deposit × ratio", "uses the ratio stored with the deposit (MO5)"; E2E shows available = limit = USD 200.00 after approval. |
| R-03 | [MUST] Authorize purchases against available credit; a purchase must never exceed the limit | ✅ | Row lock + conditional hold: `authorizations.int-spec.ts:72` (exact available approved, +1 cent declined), `:90` 50 parallel purchases never over limit; mutants on the decision killed (audit 2026-10-21). E2E over-limit decline. |
| R-04 | [MUST] Repayments restore available credit | ✅ | `settlement.int-spec.ts:44` restores credit only after provider confirmation; E2E repay step restores available to USD 200.00. |
| R-05 | [MUST] Return the deposit on close in good standing, or apply it to cover unpaid debt | ✅ | `settlement.int-spec.ts` "releases the whole collateral…", "applies the collateral to the debt first…", close with holds → 409; E2E close returns USD 200.00. |
| R-06 | [MUST] Every measure and strategy needed so the critical service works as expected | ✅ | Ledger, idempotency (with lease), locks, outbox, signed services, audit, hold expiry, payout retries, payment expiry (`1ae6c3c`); see `docs/architecture.md` "Critical-service guarantees" and "Failure modes". |

## B. Non-functional

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R-07 | [MUST] Architecture chosen and explained thoroughly, with clear concepts | ✅ | `docs/adr/0001-lending-core-plus-satellites.md` (options, decision, extraction path), `docs/architecture.md` (context, container, sequence and ER diagrams), `docs/thinking-process.md` §2; linked from the README "Architecture" section. |
| R-08a | [MUST] Safe concurrency (e.g. two purchases on the same card at once) | ✅ | Row lock + conditional hold: `authorizations.int-spec.ts:91` (50 parallel purchases never over the limit), `holds.int-spec.ts` capture ∥ release, `domain-hardening.int-spec.ts` N parallel deposits, `payouts.int-spec.ts` N parallel senders. |
| R-08b | [MUST] Security | ✅ | JWT + argon2, RBAC, default-deny routes, HMAC covering the Idempotency-Key (`signatures.int-spec.ts`), masked admin card (exact keys, `admin.int-spec.ts`), safe returnTo (24 attack strings), void bound to the card, Secure cookie in production, no credentials in bundles (`d1153f9`, `1ae6c3c`). |
| R-08c | [MUST] Data consistency | ✅ | Double-entry journal with a deferred balancing trigger (`platform.int-spec.ts`), CHECK constraints on balances, audit + outbox in the same transaction; per-account reconciliation of cached balances vs the journal on the admin dashboard and a worker job (`reconciliation.int-spec.ts`: a corrupted cached balance is reported). |
| R-08d | [MUST] Idempotency | ✅ | Client Idempotency-Key required on every money POST, stored with the effect: `idempotency.spec.ts`, `authorizations.int-spec.ts:127`, checkout quantity fingerprint (`ee9accd`). |
| R-08e | [MUST] Auditability | ✅ | Append-only `audit_log` written in the same transaction; admin audit log page filtered by entity: E2E `admin-golden-path.spec.ts`. |
| R-08f | [MUST] Correct handling of money amounts | ✅ | BIGINT cents end to end (P1), one parser in contracts rejecting a third decimal: `money.spec.ts` (api + contracts); `formatCents` with Intl. |
| R-09 | [SHOULD] Real services easy to run locally (containers) | ✅ | `pnpm start` boots postgres:18, RustFS, api, worker, card-network, web and admin, all healthy, and prints every URL; `pnpm stop` stops it. `pnpm test:all` runs every check including E2E. |
| R-10 | [MUST] Explain deployment to a cloud provider · [SHOULD] some IaC | ✅ | `docs/deploy.md` (AWS: ECS Fargate api/worker/card-network, RDS Postgres 18, S3 + CloudFront for web/admin, Secrets Manager, CloudWatch alarms, step-by-step deploy, CI/CD, DR); IaC `infra/terraform/` — `terraform fmt -check` + `terraform validate` → "Success! The configuration is valid." (hashicorp/terraform:1.11). |
| R-17 | [SHOULD] Python, TypeScript or Go | ✅ | TypeScript 6.0.3 in every package, `strict` + `noUncheckedIndexedAccess` (`tsconfig.base.json`); `pnpm typecheck` exit 0. |
| R-18 | [SHOULD] Quality over quantity | ✅ | Full audit chain + fixes (`docs/audits/2026-10-21-full.md` → H0–H4 commits), mutation-checked rules, `pnpm test:all` green (lint, typecheck, unit with 90 % gate, integration on Postgres, E2E 16/16, format). |

## C. Delivery

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R-11 | [SHOULD] AI told what to do rather than how to think | ✅ | The AI was given goals and rules (CLAUDE.md harness, kit audits), not its reasoning; see `docs/thinking-process.md` "How AI was used" and the transcript. |
| R-12 | [MUST] Every prompt and every response, in order, in the repo (PROMPTS.md or exported log) | ✅ | `docs/PROMPTS.md` (index) + `docs/prompts/01-acme-credit-build.md`: session transcript.
| R-13 | [MUST] Thinking process: architecture, stack, critical-part strategy, trade-offs | ✅ | `docs/thinking-process.md` (approach, options, stack, trade-offs, AI usage, audit) + `docs/architecture.md` (diagrams, flows, guarantees table with test names, failure modes) + ADRs 0001–0005. |
| R-14 | [MUST] Delivered within 5 calendar days (by 2026-10-26) | ✅ | Delivered 2026-10-22, before the 2026-10-26 deadline (last commit on `main`). |
| R-15 | [MUST] Delivered via GitHub, ZIP or PDF, with the source files | ✅ | Public GitHub repository https://github.com/erfajc97/acme-credit (`main`), shared 2026-10-22. |
| R-16 | [OPT] Live demo | ❌ | Optional; no hosted demo (the stack runs locally with `pnpm start`; deployment is documented in `docs/deploy.md`). |

## D. Our extras

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R-50 | [OPT] Customer app + admin dashboard with its own login, responsive (360 px), one brand + shared components | ✅ | Two Astro apps sharing `packages/ui` and brand tokens; admin with its own login; 360 px E2E project; fit-to-viewport from 1024 to 2560 (`725d549`, `b2979ac`). |
| R-51 | [OPT] Simulated purchases made from the customer app appear in the admin | ✅ | E2E `admin-golden-path.spec.ts`: a purchase made in the wallet appears in admin Purchases with its items. |
| R-52 | [OPT] Card freeze / unfreeze | ✅ | Customer freeze/unfreeze with confirmation; admin freeze with a reason that the customer cannot lift (`domain-hardening.int-spec.ts`, `settlement.int-spec.ts:82`). |
| R-53 | [OPT] Monthly statements in object storage | ❌ | Optional idea of the statement, not built (disclosed in `docs/thinking-process.md` §7). |
| R-54 | [OPT] Interest and late fees | ❌ | Optional idea of the statement, not built (disclosed in `docs/thinking-process.md` §7). |
| R-55 | [OPT] Limit increase via additional collateral | ✅ | `lending.int-spec.ts:199` "raises the limit of an ACTIVE account with another confirmed deposit (R-55)"; card page "Sube tu límite". |

## Interpretations

| ID | Reading taken | Documented in |
|---|---|---|
| R-01 | "Confirming" = the payment provider (simulated) confirms the funds via a signed webhook that is re-read at the provider; the client never confirms money | plan §3, ADR (F3) |
| R-02 | Limit = confirmed collateral × policy ratio (100 %), ratio stored with the deposit | plan §3 |
| R-03 | "Limit" = available credit (limit − holds − posted debt); a hold is placed at authorization | plan §3 |
| R-07 | Microservice recommended; we ship a modular-monolith core + satellite services and justify it | plan §4.1, ADR-0001 |
| R-09 | Real Postgres + S3-compatible object storage (RustFS) in Docker Compose instead of in-memory | plan §4.5, ADR-0005 |
| R-12 | `docs/PROMPTS.md` is the index; the verbatim transcript of every Claude Code session goes to `docs/prompts/NN-*.md`, in order | plan §6, `docs/PROMPTS.md` |
