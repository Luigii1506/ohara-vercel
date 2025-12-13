-- This migration cleans up legacy MySQL flavored SQL so future migrations can run

-- Drop indexes created via DROP INDEX ... ON syntax (Neon/Postgres friendly)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'CardPriceLog'
      AND indexname = 'CardPriceLog_cardId_fkey'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS "CardPriceLog_cardId_fkey"';
  END IF;
END $$;

-- (Add similar blocks if other indexes with MySQL syntax exist)
