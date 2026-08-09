-- Donations are financial records that must outlive the bot-user row. The
-- generated relation was ON DELETE SET NULL against a NOT NULL column, which
-- made deleting any donor fail outright. Drops only the constraint; no data is
-- touched and the column is kept.
ALTER TABLE "donations" DROP CONSTRAINT IF EXISTS "donations_telegramUserId_fkey";
