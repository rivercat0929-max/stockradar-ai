CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlertRule" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "operator" TEXT,
  "threshold" DOUBLE PRECISION,
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlertEvent" (
  "id" TEXT NOT NULL,
  "alertRuleId" TEXT,
  "symbol" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "marketPrice" DOUBLE PRECISION,
  "marketDataSource" TEXT,
  "marketDataUpdatedAt" TIMESTAMP(3),
  "isStale" BOOLEAN NOT NULL DEFAULT false,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyReport" (
  "id" TEXT NOT NULL,
  "reportDate" DATE NOT NULL,
  "reportContent" JSONB NOT NULL,
  "summaryText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketDataCache" (
  "symbol" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "originalSource" TEXT,
  "updatedAt" TIMESTAMP(3),
  "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketDataCache_pkey" PRIMARY KEY ("symbol")
);

CREATE TABLE IF NOT EXISTS "EventCache" (
  "cacheKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventCache_pkey" PRIMARY KEY ("cacheKey")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlertEvent_alertRuleId_fkey'
  ) THEN
    ALTER TABLE "AlertEvent"
    ADD CONSTRAINT "AlertEvent_alertRuleId_fkey"
    FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyReport_reportDate_key" ON "DailyReport"("reportDate");
CREATE INDEX IF NOT EXISTS "AlertRule_symbol_idx" ON "AlertRule"("symbol");
CREATE INDEX IF NOT EXISTS "AlertEvent_symbol_triggeredAt_idx" ON "AlertEvent"("symbol", "triggeredAt");
