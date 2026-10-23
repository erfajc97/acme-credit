# 0001 — Lending core as a modular monolith, plus satellite services

- **Status:** accepted
- **Date:** 2026-10-21
- **Requirements:** R-07, R-06, R-08a, R-08c
- **Rules:** A1, AN1, AN5, MO3

## Context

The statement recommends a microservice but allows another style if it fits better. The service
moves money and holds part of it as a guarantee. Its most important invariant is that a purchase
never exceeds the limit. Three things must happen in one consistent step: check available credit,
place the hold, and post the ledger entry. And it must stay true with two purchases racing on the
same card.

The money flows are deposit, activation, authorization, capture, repayment and close. Each one reads
and writes the same small aggregate: the card account, its collateral and its ledger postings. The
things that are really outside our trust boundary are:

- the card network that asks for authorizations;
- the payment provider that confirms deposits and repayments;
- slow side effects such as statements and notifications.

## Options considered

### A. One microservice per domain (collateral, cards, ledger, payments)

- **Pros:** independent deploys and scaling; looks like the textbook answer.
- **Cons:**
  - The limit check and the ledger posting sit in different databases. "Never over the limit"
    then needs a distributed protocol: a saga with compensations, or 2PC.
  - A crash between "hold placed" and "posting written" leaves money in limbo until a compensator
    runs.
  - Every consistency bug becomes a distributed-systems bug.
  - Much more infrastructure (a broker, schemas, retries) for a five-day build, with no scaling
    need behind it.

### B. Lending core as a modular monolith with one Postgres, plus satellites ✅

- **Pros:**
  - Each money operation is ONE ACID transaction with a row lock on the account.
  - The invariants hold by construction, and the database enforces them too (CHECK constraints,
    a balanced journal).
  - Modules (`accounts`, `collateral`, `cards`, `ledger`, `authorizations`, `repayments`) keep
    hard boundaries in code (AN1), so any of them can be extracted later.
  - The satellites are the real external boundaries, and each has its own process and contract:
    - **card-network**: signs and retries authorization requests, simulates the merchant side;
    - **payment provider** (inside card-network for the simulation): confirms money by webhook;
    - **outbox worker**: publishes events, builds statements to object storage.
- **Cons:**
  - The core scales as one unit. Its load is per-card and small, and vertical scaling plus read
    replicas cover it.
  - One team owns the core.

### C. A single process including the network simulator

- **Pros:** the simplest option.
- **Cons:** hides the exact problems the challenge wants to see handled: retries, duplicate
  requests, signatures, timeouts between systems.

## Decision

**B.** `apps/api` is the lending core, with modules under `src/modules/<domain>`, one
Postgres database and one transaction per money operation. A second entrypoint
(`worker.ts`) runs the transactional-outbox relay. `apps/card-network` is a separate
NestJS service that calls the core over HTTP with HMAC-signed, idempotent requests and
simulates the payment provider's signed webhooks. Contracts are shared through `packages/contracts`.

## Consequences

- Money invariants are local transactions. Concurrency is solved with row locks and conditional
  updates (ADR-0003), not sagas.
- Cross-service calls are where retries and duplicates happen, so every one carries an
  idempotency key (ADR-0004) and a signature.
- Extraction path, written down for later:
  - `statements` and `notifications` move first: they already run off the outbox.
  - `ledger` moves last, and only behind an append-only API that keeps the per-account lock in
    the core.
- Enforced by AN1 (`core` never imports a module; modules only through their services) and the
  arch-check structure rules.

## Implementation

F0 scaffolds `apps/api` and `apps/card-network`; the modules arrive in F2–F5.
