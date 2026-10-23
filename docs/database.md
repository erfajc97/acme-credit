# Database — lending core

The lending core (`apps/api`) owns the only database: PostgreSQL, schema in
[`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma), built by the hand-reviewed
migrations in [`apps/api/prisma/migrations/`](../apps/api/prisma/migrations/) (never
`migrate dev`, AN8). The card network keeps no database of its own.

Conventions: ids are UUID v7 (`uuid(7)`, time-ordered); money is `BIGINT` integer cents (P1,
ADR-0002); instants are `timestamptz(3)` (UTC); business dates are `date`. Every foreign key
is `ON DELETE RESTRICT` except `refresh_tokens.user_id` (`CASCADE`).

A rendered copy of the diagram is in [`database.svg`](database.svg).

## Entity–relationship diagram

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "user_id (CASCADE)"
    users ||--o{ accounts : "customer_id"
    accounts ||--o{ collateral_deposits : "account_id"
    accounts ||--o{ repayments : "account_id"
    accounts ||--o{ payouts : "account_id"
    accounts |o--o{ authorizations : "account_id (null = invalid card)"
    accounts |o--o{ journal_entries : "account_id (null = platform entry)"
    journal_entries ||--|{ postings : "entry_id (>= 2, sum 0)"

    users {
        uuid id PK
        varchar email UK "varchar(254)"
        varchar password_hash "varchar(255), Argon2id"
        varchar full_name "varchar(120)"
        UserRole role "customer | admin"
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        uuid family_id "rotation family"
        char token_hash UK "char(64), SHA-256"
        timestamptz expires_at
        timestamptz revoked_at "nullable"
        timestamptz created_at
    }

    accounts {
        uuid id PK
        uuid customer_id FK
        AccountStatus status "PENDING_COLLATERAL | ACTIVE | FROZEN | CLOSED"
        bigint collateral_cents ">= 0"
        bigint credit_limit_cents ">= 0"
        bigint held_cents ">= 0"
        bigint posted_debt_cents ">= 0"
        char card_last4 "char(4), nullable"
        varchar card_token UK "varchar(64), nullable"
        date card_expires_on "nullable"
        timestamptz opened_at
        timestamptz activated_at "nullable"
        timestamptz closed_at "nullable"
        FreezeActor frozen_by "CUSTOMER | ADMIN, set iff FROZEN"
        FreezeReason freeze_reason "set iff FROZEN"
        timestamptz frozen_at "set iff FROZEN"
        timestamptz updated_at
    }

    collateral_deposits {
        uuid id PK
        uuid account_id FK
        bigint amount_cents "> 0"
        PaymentStatus status "PENDING | CONFIRMED | FAILED | EXPIRED"
        int limit_ratio_bps "1..10000, fixed at request"
        varchar provider_payment_id "varchar(64), nullable"
        varchar approve_url "varchar(2048), nullable"
        timestamptz created_at
        timestamptz confirmed_at "nullable"
        timestamptz expires_at "request + PENDING_PAYMENT_TTL"
    }

    repayments {
        uuid id PK
        uuid account_id FK
        bigint amount_cents "> 0"
        bigint applied_cents "0..amount_cents"
        PaymentStatus status "PENDING | CONFIRMED | FAILED | EXPIRED"
        varchar provider_payment_id "varchar(64), nullable"
        varchar approve_url "varchar(2048), nullable"
        timestamptz created_at
        timestamptz confirmed_at "nullable"
        timestamptz expires_at "request + PENDING_PAYMENT_TTL"
    }

    payouts {
        uuid id PK
        uuid account_id FK
        bigint amount_cents "> 0"
        PayoutReason reason "collateral_release | repayment_refund | deposit_refund"
        PayoutStatus status "PENDING | SENT | FAILED"
        varchar provider_payment_id "varchar(64), nullable"
        uuid provider_reference UK "one per attempt"
        int attempts ">= 1"
        timestamptz next_attempt_at "retry schedule"
        varchar last_error "varchar(64), nullable"
        timestamptz created_at
        timestamptz sent_at "nullable"
        timestamptz failed_at "nullable"
    }

    authorizations {
        uuid id PK
        uuid account_id FK "nullable"
        bigint amount_cents "> 0"
        bigint captured_cents "0..amount_cents"
        AuthorizationStatus status "APPROVED | DECLINED | CAPTURED | REVERSED"
        DeclineReason decline_reason "set iff DECLINED"
        varchar merchant_name "varchar(80)"
        char merchant_mcc "char(4)"
        jsonb items "order lines, [] for a card purchase"
        timestamptz expires_at "hold expiry, null iff DECLINED"
        ReversalReason reversal_reason "set iff REVERSED"
        timestamptz created_at
        timestamptz updated_at
    }

    journal_entries {
        uuid id PK
        JournalKind kind
        uuid account_id FK "nullable"
        varchar description "varchar(200)"
        timestamptz created_at
    }

    postings {
        uuid id PK
        uuid entry_id FK
        varchar ledger_account "varchar(80)"
        bigint amount_cents "signed, never 0"
    }

    idempotency_keys {
        uuid id PK
        varchar scope UK "varchar(64), unique with key"
        uuid key UK "unique with scope"
        char request_hash "char(64)"
        IdempotencyStatus status "PENDING | RETRYABLE | COMPLETED"
        uuid resource_id "nullable, resumed by a retry"
        int response_status "nullable"
        jsonb response_body "nullable"
        timestamptz locked_until "lease of the owning attempt"
        int attempt "owner of the lease"
        timestamptz created_at
        timestamptz updated_at
    }

    audit_log {
        uuid id PK
        ActorType actor_type "customer | admin | network | provider | system"
        varchar actor_id "varchar(64), nullable"
        varchar action "varchar(64)"
        varchar entity_type "varchar(32)"
        varchar entity_id "varchar(64)"
        varchar request_id "varchar(64), nullable"
        jsonb data
        timestamptz created_at
    }

    outbox_events {
        uuid id PK
        varchar type "varchar(64)"
        jsonb payload
        timestamptz available_at
        int attempts
        timestamptz processed_at "nullable"
        varchar last_error "varchar(500), nullable"
        timestamptz created_at
    }
```

`idempotency_keys`, `audit_log` and `outbox_events` carry no foreign key on purpose: they
reference resources by id across tables (`audit_log.entity_id`, `idempotency_keys.resource_id`)
and must outlive or precede the rows they describe.

## Guarantees enforced by the database

What Prisma cannot express lives in the hand-written part of each migration and is documented
with `///` on its model. The application checks these rules first; the database is the last
line of defence when two requests race or a bug slips through.

| Guarantee | Object | Kind | Migration |
| --- | --- | --- | --- |
| Account balances never negative (`collateral`, `credit_limit`, `held`, `posted_debt` ≥ 0) | `accounts_balances_non_negative` | CHECK | `20261021191651_lending_core` |
| While not CLOSED, `held + posted_debt ≤ credit_limit` (behind the row lock, ADR-0003) | `accounts_within_limit` | CHECK | `20261021191651_lending_core` |
| At most one non-CLOSED account per customer | `accounts_one_open_per_customer` on `(customer_id) WHERE status <> 'CLOSED'` | Partial unique index | `20261021191651_lending_core` |
| `frozen_by`, `freeze_reason`, `frozen_at` set exactly while FROZEN | `accounts_frozen_by` | CHECK | `20261022191708_domain_hardening` |
| Deposit amount > 0; limit ratio in `(0, 10000]` bps | `collateral_deposits_amount_positive`, `collateral_deposits_ratio_range` | CHECK | `20261021191651_lending_core` |
| Repayment amount > 0; `0 ≤ applied ≤ amount` | `repayments_amount_positive`, `repayments_applied_range` | CHECK | `20261021191651_lending_core` |
| Payout amount > 0 | `payouts_amount_positive` | CHECK | `20261021191651_lending_core` |
| Payout attempts ≥ 1; one provider reference per attempt | `payouts_attempts_positive`, `payouts_provider_reference_key` | CHECK, unique index | `20261022191708_domain_hardening` |
| Authorization amount > 0; `0 ≤ captured ≤ amount` | `authorizations_amount_positive`, `authorizations_captured_range` | CHECK | `20261021191651_lending_core` |
| A decline reason exactly when DECLINED | `authorizations_decline_reason` | CHECK | `20261021191651_lending_core` |
| A hold expiry exactly when not DECLINED; a reversal reason exactly when REVERSED | `authorizations_expiry`, `authorizations_reversal_reason` | CHECK | `20261022191708_domain_hardening` |
| A posting is never zero | `postings_amount_non_zero` | CHECK | `20261021191651_lending_core` |
| At commit, every journal entry has ≥ 2 postings summing to zero | `journal_entries_balanced`, `postings_balanced` → `assert_journal_entry_balanced()` | Constraint triggers, `DEFERRABLE INITIALLY DEFERRED` | `20261021191651_lending_core` |
| The ledger is append-only (UPDATE / DELETE rejected) | `journal_entries_append_only`, `postings_append_only` → `reject_ledger_rewrite()` | Triggers | `20261021191651_lending_core` |
| One idempotency record per `(scope, key)` | `idempotency_keys_scope_key_key` | Unique index | `20261021191651_lending_core` |
| One user per email; one session per token hash; one account per card token | `users_email_key`, `refresh_tokens_token_hash_key`, `accounts_card_token_key` | Unique indexes | `20261021191651_lending_core` |

### Indexes for keyset pagination and the worker

Every list is keyset-paginated newest first (`ORDER BY created_at DESC, id DESC`, cursor
`(created_at, id) < (…)`, migration `20261022015001_keyset_list_indexes`): each page starts at
the cursor and reads `limit + 1` rows, however deep.

| Table | Index | Serves |
| --- | --- | --- |
| `accounts` | `(status, opened_at DESC, id DESC)`, `(opened_at DESC, id DESC)`, `(customer_id, opened_at)` | Admin account list (filtered and not); the customer's account |
| `collateral_deposits` | `(account_id, created_at DESC, id DESC)`, `(status, created_at)` | Deposit history; the sweep of stale PENDING payments |
| `repayments` | `(account_id, created_at DESC, id DESC)`, `(status, created_at)` | Repayment history; the sweep of stale PENDING payments |
| `payouts` | `(account_id, created_at DESC, id DESC)`, `(created_at DESC, id DESC)`, `(status, created_at DESC, id DESC)`, `(status, next_attempt_at)` | Payout lists; the worker's due-retry scan |
| `authorizations` | `(account_id, created_at DESC, id DESC)`, `(created_at DESC, id DESC)`, `(status, created_at DESC, id DESC)`, `(status, expires_at)` | Purchase lists; the worker's hold-expiry sweep |
| `journal_entries` | `(account_id, created_at DESC, id DESC)`, `(created_at DESC, id DESC)` | Account ledger and global ledger |
| `postings` | `(entry_id)`, `(ledger_account)` | Postings of an entry; reconciliation per ledger account |
| `audit_log` | `(entity_id, created_at DESC, id DESC)`, `(created_at DESC, id DESC)` | Audit trail of one entity and the whole log |
| `outbox_events` | `(processed_at, available_at)` | The worker's claim (`FOR UPDATE SKIP LOCKED`) of due events |
| `refresh_tokens` | `(user_id)`, `(family_id)` | Revoking a user's sessions or a whole rotation family |
| `idempotency_keys` | `(created_at)` | Time-ordered scans of keys (no purge job exists yet) |
| `users` | `(full_name)` | Name lookups; note the admin search is `contains` (`ILIKE '%q%'`), which a btree index cannot serve |
