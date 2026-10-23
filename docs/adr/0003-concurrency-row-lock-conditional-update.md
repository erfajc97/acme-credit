# 0003 — Concurrency: account row lock plus conditional update

- **Status:** accepted
- **Date:** 2026-10-21
- **Requirements:** R-03, R-08a, R-08c
- **Rules:** AN5, AN6, MO3, MO6

## Context

"Two purchases hitting the same card at once" must never both pass when only one fits. The same
balance is also written by:

- captures and reversals;
- repayments confirmed by webhook;
- freeze, close, and collateral application.

Contention per card is low (one human, one card), but correctness has to be absolute.

## Options considered

### A. Optimistic concurrency (version column, retry on conflict)

- **Pros:** no blocking.
- **Cons:** every writer needs a retry loop. Under a burst (the 50-parallel test), retries pile up
  and fail with spurious 409s.

### B. `SERIALIZABLE` for everything

- **Pros:** the database proves serializability.
- **Cons:** serialization failures need retries everywhere, and analysing what is safe gets harder.

### C. Pessimistic lock on the account row as the first statement + conditional update ✅

- **Pros:**
  - Every writer of a card's money takes `SELECT … FROM card_accounts WHERE id = $1 FOR UPDATE`
    first, so writers on one card queue and different cards never block each other.
  - The authorization itself is also a conditional update (`… SET held = held + $amount WHERE id = $1
    AND credit_limit - held - posted_debt >= $amount`) with the row count checked: belt and braces.
  - The DB `CHECK (held + posted_debt <= credit_limit)` is the last line of defence.
- **Cons:** the lock is held for the transaction's length, so transactions stay short and side
  effects run after commit.

## Decision

**C.**

- **Lock order:** one global order: the account row first, then the collateral row, then the
  idempotency row. Each touches one account, so no deadlock cycle exists.
- **Lock timeout:** `lock_timeout = 3s`. Hitting it maps to 409 `operation.in_progress`.
- **Retries:** the one retry helper wraps the transaction and retries `40001` / `40P01` up to 3
  times with jitter.

## Consequences

- An integration test fires N = 50 parallel authorizations of a value that fits only K times and
  asserts:
  - exactly K approvals;
  - `available ≥ 0`;
  - the journal balances.
- Another fires a repayment and a purchase together.
- Writers that skip the lock are caught by review (MO3 check) and by the DB CHECK constraint.

## Implementation

F2 builds the lock and retry helpers. F4 builds the authorization path and the concurrency suite.
