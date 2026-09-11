-- Enable pg_trgm extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes for fast course search
CREATE INDEX IF NOT EXISTS idx_courses_title_trgm ON "courses" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_short_description_trgm ON "courses" USING GIN ("short_description" gin_trgm_ops);
