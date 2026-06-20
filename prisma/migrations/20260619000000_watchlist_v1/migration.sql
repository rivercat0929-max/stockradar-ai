ALTER TABLE "Watchlist"
ADD COLUMN "group" TEXT NOT NULL DEFAULT '重点观察',
ADD COLUMN "targetBuyPrice" DOUBLE PRECISION,
ADD COLUMN "targetSellPrice" DOUBLE PRECISION,
ADD COLUMN "watchReason" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Watchlist_userId_ticker_key" ON "Watchlist"("userId", "ticker");
