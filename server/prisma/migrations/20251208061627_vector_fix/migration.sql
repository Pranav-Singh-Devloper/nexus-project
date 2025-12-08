-- 1. Enable the Vector Extension (Critical)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column safely
-- We use ALTER TABLE because the table already exists from previous migrations
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "embedding" vector(384);