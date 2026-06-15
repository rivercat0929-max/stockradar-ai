CREATE TABLE "PortfolioAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "broker" TEXT,
  "accountType" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioAccount_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PortfolioAccount" ("id", "name", "currency", "createdAt", "updatedAt")
VALUES ('default-account', 'Default Account', 'USD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Holding" ADD COLUMN "accountId" TEXT;

UPDATE "Holding"
SET "accountId" = 'default-account'
WHERE "accountId" IS NULL;

ALTER TABLE "Holding" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "PortfolioAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
