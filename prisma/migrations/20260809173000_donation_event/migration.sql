-- Adds the DONATION event type.
--
-- Kept alone in its own migration: PostgreSQL will not let a newly added enum
-- value be used in the same transaction that adds it. Guarded so re-running is
-- harmless (ADD VALUE IF NOT EXISTS still errors inside some transaction
-- states, so the existence check is explicit).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'TelegramEventType' AND e.enumlabel = 'DONATION'
  ) THEN
    ALTER TYPE "TelegramEventType" ADD VALUE 'DONATION';
  END IF;
END
$$;
