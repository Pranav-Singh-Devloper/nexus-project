-- AlterTable
-- This must be the first line
CREATE EXTENSION IF NOT EXISTS vector;

-- Then your other changes (Alter Table, etc.)
ALTER TABLE "Project" ADD COLUMN "embedding" vector(384);

ALTER TABLE "User" ADD COLUMN     "password" TEXT;
