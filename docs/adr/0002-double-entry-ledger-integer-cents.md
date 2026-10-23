# 0002 — Double-entry ledger in integer cents

- **Status:** accepted
- **Date:** 2026-10-21
- **Requirements:** R-08c, R-08e, R-08f, R-01–R-05
- **Rules:** A6, AN9 (deviation, see P1), MO1, MO6

## Context

Money has to be exact, auditable and reconstructible:

- **Exact:** no float drift.
- **Auditable:** every movement can be explained.
- **Reconstructible:** balances can be recomputed from history.

The product handles a single currency (USD) and never deals with fractions of a cent: there are no
FX conversions and no per-unit pricing. Interest, which comes later, is computed once per cycle and
rounded once.

## Options considered

### A. Mutable balance columns only

- **Pros:** simple.
- **Cons:** no history. A bug silently corrupts the balance, and nothing proves what happened.

### B. `Decimal(p, s)` amounts (the kit default, AN9)

- **Pros:** exact; the Prisma default for money.
- **Cons:** Prisma `Decimal` is decimal.js. It is easy to drop into `Number` by accident, and
  scale-2 arithmetic still needs explicit rounding at every step. For a single currency with cent
  precision it adds a library without adding precision.

### C. Integer minor units (`BIGINT` cents) + double-entry journal ✅

- **Pros:**
  - Integer arithmetic is exact and fast, with native `bigint` in TS and Postgres.
  - Every movement is a journal entry whose postings sum to zero, enforced by a deferred
    constraint trigger.
  - Cached balances can be checked against the journal (trial balance), and audit is the journal
    itself.
- **Cons:**
  - Converting to display units is needed at the edges.
  - `bigint` does not serialize to JSON.

## Decision

**C.**

- **Database:** amounts are `BIGINT` cents with `CHECK (amount > 0)` where it applies.
- **Code:** amounts are a `Money` value object around `bigint`.
- **JSON:** amounts are strings of integer cents (`"12550"`).
- **Parsing and display:** a decimal string like `"125.50"` is parsed into cents by one function
  that rejects more than 2 fractional digits, signs where not allowed, and exponents. Display uses
  `Intl.NumberFormat` from cents.
- **Ledger accounts** (as built):
  - per customer account: `collateral:<accountId>` (liability: the deposit we hold) and
    `receivable:<accountId>` (asset: what the customer owes);
  - global: `cash_clearing` (money in and out through the provider) and `merchant_settlement`.
  - A purchase hold is not a journal entry: it is the cached `held_cents` (with its CHECK),
    because a hold is a reservation, not a movement of money; the journal is written at capture.
- **Cached balances:** `credit_limit_cents`, `held_cents`, `posted_debt_cents`,
  `collateral_cents` on `accounts`, updated in the same transaction as the journal entry.
- **Reconciliation (R-08c):** one query compares, per account, `collateral_cents` with
  −Σ `collateral:<id>` and `posted_debt_cents` with Σ `receivable:<id>`
  (`apps/api/src/core/ledger/reconciliation.ts`). The admin dashboard shows accounts checked
  and mismatches; the worker runs it every 5 minutes and logs each new mismatch once.
  Proven by `reconciliation.int-spec.ts` (a corrupted cached balance is detected).

Interest and fees (not built; R-54 optional), if built, compute in cents with half-even rounding in ONE helper (MO1).

## Consequences

- Recorded as project rule **P1** so auditors do not flag `BIGINT` money against AN9.
- `parseFloat` is banned in the services by lint, and money parsing has boundary and rounding
  fixtures (MO6).
- The admin ledger explorer reads straight from the journal.

## Implementation

F2: `Money`, journal tables and the trigger, and the posting service.
