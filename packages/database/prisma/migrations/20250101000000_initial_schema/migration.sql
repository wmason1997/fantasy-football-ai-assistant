-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),
    "pushToken" VARCHAR(500),
    "notificationPreferences" JSONB NOT NULL DEFAULT '{"injuryAlerts": true, "tradeSuggestions": true, "waiverReminders": true, "autoSubstitute": false}',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "platformLeagueId" VARCHAR(100) NOT NULL,
    "leagueName" VARCHAR(200),
    "teamName" VARCHAR(200),
    "platformTeamId" VARCHAR(100),
    "scoringSettings" JSONB,
    "rosterSettings" JSONB,
    "faabBudget" INTEGER,
    "currentFaab" INTEGER,
    "waiverPriority" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSynced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" VARCHAR(50) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "position" VARCHAR(10) NOT NULL,
    "team" VARCHAR(10),
    "status" VARCHAR(20),
    "injuryDesignation" VARCHAR(100),
    "byeWeek" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rosters" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rosterSlot" VARCHAR(20) NOT NULL,
    "isStarting" BOOLEAN NOT NULL DEFAULT false,
    "acquiredDate" TIMESTAMP(3),
    "acquisitionCost" INTEGER,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "transactionType" VARCHAR(20) NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "involvedTeams" JSONB NOT NULL,
    "playersMoved" JSONB NOT NULL,
    "proposerTeamId" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL,
    "proposedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "platformTransactionId" VARCHAR(100),
    "metadata" JSONB,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_projections" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "stats" JSONB,
    "confidence" DOUBLE PRECISION DEFAULT 0.5,
    "source" VARCHAR(50) NOT NULL DEFAULT 'sleeper',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_recommendations" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "myPlayers" JSONB NOT NULL,
    "targetPlayers" JSONB NOT NULL,
    "targetTeamId" VARCHAR(100) NOT NULL,
    "targetTeamName" VARCHAR(200),
    "fairnessScore" DOUBLE PRECISION NOT NULL,
    "acceptanceProbability" DOUBLE PRECISION NOT NULL,
    "myValueGain" DOUBLE PRECISION NOT NULL,
    "targetValueGain" DOUBLE PRECISION NOT NULL,
    "tradeType" VARCHAR(20) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "sellHighPlayers" JSONB,
    "buyLowPlayers" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "viewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opponent_profiles" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "opponentTeamId" VARCHAR(100) NOT NULL,
    "opponentTeamName" VARCHAR(200),
    "qbPreference" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "rbPreference" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "wrPreference" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tePreference" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "riskTolerance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tradingActivity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "totalTradesProposed" INTEGER NOT NULL DEFAULT 0,
    "totalTradesAccepted" INTEGER NOT NULL DEFAULT 0,
    "totalTradesRejected" INTEGER NOT NULL DEFAULT 0,
    "totalTradesInitiated" INTEGER NOT NULL DEFAULT 0,
    "prefersStars" BOOLEAN NOT NULL DEFAULT false,
    "prefersDepth" BOOLEAN NOT NULL DEFAULT false,
    "valuesSafety" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTradeDate" TIMESTAMP(3),
    "dataPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "opponent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiver_recommendations" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" VARCHAR(200) NOT NULL,
    "position" VARCHAR(10) NOT NULL,
    "team" VARCHAR(10),
    "opportunityScore" DOUBLE PRECISION NOT NULL,
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "recentPerformance" DOUBLE PRECISION NOT NULL,
    "targetShare" DOUBLE PRECISION,
    "snapShare" DOUBLE PRECISION,
    "injuryImpact" BOOLEAN NOT NULL DEFAULT false,
    "positionalNeed" DOUBLE PRECISION NOT NULL,
    "wouldStartImmediately" BOOLEAN NOT NULL DEFAULT false,
    "benchDepthScore" DOUBLE PRECISION NOT NULL,
    "recommendedBid" INTEGER,
    "minBid" INTEGER,
    "maxBid" INTEGER,
    "medianHistoricalBid" INTEGER,
    "addTrendPercentage" DOUBLE PRECISION,
    "priorityRank" INTEGER NOT NULL DEFAULT 0,
    "shouldClaim" BOOLEAN NOT NULL DEFAULT false,
    "suggestedDropPlayerId" TEXT,
    "suggestedDropPlayerName" VARCHAR(200),
    "dropPlayerValue" DOUBLE PRECISION,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "viewedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waiver_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injury_alerts" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "injuredPlayerId" TEXT NOT NULL,
    "injuredPlayerName" VARCHAR(200) NOT NULL,
    "position" VARCHAR(10) NOT NULL,
    "team" VARCHAR(10),
    "previousStatus" VARCHAR(20) NOT NULL,
    "newStatus" VARCHAR(20) NOT NULL,
    "injuryDesignation" VARCHAR(100),
    "gameTime" TIMESTAMP(3) NOT NULL,
    "gameId" VARCHAR(100),
    "opponent" VARCHAR(10),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutesToKickoff" INTEGER NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "recommendedSubPlayerId" TEXT,
    "recommendedSubPlayerName" VARCHAR(200),
    "recommendedSubProjection" DOUBLE PRECISION,
    "autoSubstituted" BOOLEAN NOT NULL DEFAULT false,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "pushToken" VARCHAR(500),
    "urgencyLevel" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "userAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "userSubstituted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "injury_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "leagues_userId_idx" ON "leagues"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_platform_platformLeagueId_platformTeamId_key" ON "leagues"("platform", "platformLeagueId", "platformTeamId");

-- CreateIndex
CREATE INDEX "players_status_idx" ON "players"("status");

-- CreateIndex
CREATE INDEX "rosters_leagueId_idx" ON "rosters"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "rosters_leagueId_playerId_key" ON "rosters"("leagueId", "playerId");

-- CreateIndex
CREATE INDEX "transactions_leagueId_week_season_idx" ON "transactions"("leagueId", "week", "season");

-- CreateIndex
CREATE INDEX "player_projections_playerId_week_season_idx" ON "player_projections"("playerId", "week", "season");

-- CreateIndex
CREATE INDEX "player_projections_week_season_idx" ON "player_projections"("week", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_projections_playerId_week_season_source_key" ON "player_projections"("playerId", "week", "season", "source");

-- CreateIndex
CREATE INDEX "trade_recommendations_leagueId_week_season_idx" ON "trade_recommendations"("leagueId", "week", "season");

-- CreateIndex
CREATE INDEX "trade_recommendations_leagueId_status_idx" ON "trade_recommendations"("leagueId", "status");

-- CreateIndex
CREATE INDEX "trade_recommendations_week_season_idx" ON "trade_recommendations"("week", "season");

-- CreateIndex
CREATE INDEX "opponent_profiles_leagueId_idx" ON "opponent_profiles"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "opponent_profiles_leagueId_opponentTeamId_key" ON "opponent_profiles"("leagueId", "opponentTeamId");

-- CreateIndex
CREATE INDEX "waiver_recommendations_leagueId_week_season_idx" ON "waiver_recommendations"("leagueId", "week", "season");

-- CreateIndex
CREATE INDEX "waiver_recommendations_leagueId_status_idx" ON "waiver_recommendations"("leagueId", "status");

-- CreateIndex
CREATE INDEX "waiver_recommendations_playerId_idx" ON "waiver_recommendations"("playerId");

-- CreateIndex
CREATE INDEX "injury_alerts_leagueId_week_season_idx" ON "injury_alerts"("leagueId", "week", "season");

-- CreateIndex
CREATE INDEX "injury_alerts_gameTime_idx" ON "injury_alerts"("gameTime");

-- CreateIndex
CREATE INDEX "injury_alerts_notificationSent_idx" ON "injury_alerts"("notificationSent");

-- CreateIndex
CREATE INDEX "injury_alerts_injuredPlayerId_idx" ON "injury_alerts"("injuredPlayerId");

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_projections" ADD CONSTRAINT "player_projections_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_recommendations" ADD CONSTRAINT "trade_recommendations_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opponent_profiles" ADD CONSTRAINT "opponent_profiles_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiver_recommendations" ADD CONSTRAINT "waiver_recommendations_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injury_alerts" ADD CONSTRAINT "injury_alerts_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

