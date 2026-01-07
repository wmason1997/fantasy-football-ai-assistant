-- AlterTable
ALTER TABLE "player_projections" ADD COLUMN     "basedOnWeeks" INTEGER,
ADD COLUMN     "calculationMethod" TEXT DEFAULT 'weighted_average',
ADD COLUMN     "recentAverage" DOUBLE PRECISION,
ADD COLUMN     "trendMultiplier" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "player_week_stats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "pprPoints" DOUBLE PRECISION,
    "halfPprPoints" DOUBLE PRECISION,
    "stdPoints" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'sleeper',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_week_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_week_stats_playerId_season_idx" ON "player_week_stats"("playerId", "season");

-- CreateIndex
CREATE INDEX "player_week_stats_week_season_idx" ON "player_week_stats"("week", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_week_stats_playerId_week_season_source_key" ON "player_week_stats"("playerId", "week", "season", "source");

-- AddForeignKey
ALTER TABLE "player_week_stats" ADD CONSTRAINT "player_week_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
