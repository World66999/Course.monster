-- AlterEnum
-- Split into its own migration: Postgres forbids using a newly-added enum
-- value in the same transaction that adds it (needed by the next migration,
-- which sets it as the users.role column default).
ALTER TYPE "Role" ADD VALUE 'USER';
