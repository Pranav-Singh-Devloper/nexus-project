-- Free-tier guards: usage counters + web search cache. Idempotent.

CREATE TABLE IF NOT EXISTS "UsageCounter" (
    "scope" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("scope", "action", "period")
);

CREATE TABLE IF NOT EXISTS "SearchCache" (
    "key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "SearchCache_createdAt_idx" ON "SearchCache"("createdAt");
