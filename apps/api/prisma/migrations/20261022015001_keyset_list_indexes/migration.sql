-- Why: every list is keyset-paginated newest first (`ORDER BY created_at DESC, id DESC`, cursor
-- `(created_at, id) < (…)`). Indexes on (filter, created_at DESC, id DESC) let each page start at
-- the cursor and stop after `limit + 1` rows, however deep the page; the old (filter, created_at)
-- indexes are prefixes of the new ones and are dropped after the new ones exist.
-- Plain CREATE INDEX (not CONCURRENTLY): it locks writes on each table while it builds, which is
-- fine at today's sizes; on a large table, build it CONCURRENTLY by hand before deploying.

-- CreateIndex
CREATE INDEX "accounts_status_opened_at_id_idx" ON "accounts"("status", "opened_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "accounts_opened_at_id_idx" ON "accounts"("opened_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entity_id_created_at_id_idx" ON "audit_log"("entity_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_log_created_at_id_idx" ON "audit_log"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "authorizations_account_id_created_at_id_idx" ON "authorizations"("account_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "authorizations_created_at_id_idx" ON "authorizations"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "authorizations_status_created_at_id_idx" ON "authorizations"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "collateral_deposits_account_id_created_at_id_idx" ON "collateral_deposits"("account_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_account_id_created_at_id_idx" ON "journal_entries"("account_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_created_at_id_idx" ON "journal_entries"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "repayments_account_id_created_at_id_idx" ON "repayments"("account_id", "created_at" DESC, "id" DESC);

-- DropIndex
DROP INDEX "accounts_opened_at_idx";

-- DropIndex
DROP INDEX "accounts_status_opened_at_idx";

-- DropIndex
DROP INDEX "audit_log_created_at_idx";

-- DropIndex
DROP INDEX "audit_log_entity_id_created_at_idx";

-- DropIndex
DROP INDEX "authorizations_account_id_created_at_idx";

-- DropIndex
DROP INDEX "authorizations_created_at_idx";

-- DropIndex
DROP INDEX "collateral_deposits_account_id_created_at_idx";

-- DropIndex
DROP INDEX "journal_entries_account_id_created_at_idx";

-- DropIndex
DROP INDEX "journal_entries_created_at_idx";

-- DropIndex
DROP INDEX "repayments_account_id_created_at_idx";

