-- In-wallet store: an authorization keeps the priced order lines of the purchase ([] for a plain card purchase).
-- AlterTable
ALTER TABLE "authorizations" ADD COLUMN     "items" JSONB NOT NULL DEFAULT '[]';
