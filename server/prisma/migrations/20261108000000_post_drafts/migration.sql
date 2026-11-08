-- Post drafts: server-side drafts + post history. Idempotent.

ALTER TABLE "ScheduledPost" ADD COLUMN IF NOT EXISTS "draftId" TEXT;

CREATE TABLE IF NOT EXISTS "PostDraft" (
    "id" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "imageStyle" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "provider" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "postUrl" TEXT,
    "error" TEXT,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PostDraft_userId_status_updatedAt_idx" ON "PostDraft"("userId", "status", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduledPost_draftId_fkey') THEN
    ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PostDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDraft_projectId_fkey') THEN
    ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDraft_userId_fkey') THEN
    ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: give every existing scheduled/published post a history entry.
WITH src AS (
  SELECT sp.*, gen_random_uuid()::text AS new_id
  FROM "ScheduledPost" sp
  WHERE sp."draftId" IS NULL
), ins AS (
  INSERT INTO "PostDraft" ("id", "html", "imageUrl", "status", "provider", "scheduledAt", "publishedAt", "postUrl", "error", "userId", "createdAt", "updatedAt")
  SELECT
    new_id,
    '<p>' || replace(replace(replace(replace(content, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>') || '</p>',
    "imageUrl",
    CASE status WHEN 'published' THEN 'published' WHEN 'failed' THEN 'failed' ELSE 'scheduled' END,
    provider,
    "scheduledAt",
    CASE WHEN status = 'published' THEN "scheduledAt" END,
    CASE WHEN status = 'published' AND provider = 'linkedin' AND "providerPostId" IS NOT NULL
         THEN 'https://www.linkedin.com/feed/update/' || "providerPostId" END,
    error,
    "userId",
    "createdAt",
    "createdAt"
  FROM src
  RETURNING "id"
)
UPDATE "ScheduledPost" sp SET "draftId" = src.new_id FROM src WHERE sp."id" = src."id";
