# Fantasy Football AI Assistant - Product Requirements Document

**Version:** 1.0  
**Author:** Will  
**Last Updated:** December 30, 2025  
**Target Launch:** August 2026 (before 2026 NFL season)

---

## 1. Executive Summary

### 1.1 Vision
Create an intelligent Fantasy Football management application that provides data-driven trade recommendations, automated waiver wire optimization, real-time injury monitoring with auto-substitution, and learns opponent tendencies throughout the season to give users a competitive edge in their leagues.

### 1.2 Problem Statement
Fantasy Football managers face three critical pain points:
1. **Trade Timing**: Identifying optimal buy-low/sell-high opportunities requires constant monitoring and statistical analysis beyond what casual players can perform
2. **Waiver Wire Strategy**: Determining FAAB bid amounts or claim priority orders is complex, especially accounting for roster construction and positional scarcity
3. **Last-Minute Lineup Changes**: Injury announcements within minutes of game time often catch managers off-guard, resulting in starting inactive players

### 1.3 Target Users
- Competitive Fantasy Football players in 10-14 team leagues
- Users comfortable with data-driven decision making
- Managers willing to delegate tactical decisions to AI with approval workflows
- Players in leagues using FAAB (Free Agent Acquisition Budget) or waiver priority systems

### 1.4 Success Metrics
- **User Engagement**: Daily active users during NFL season >60% of registered base
- **Feature Adoption**: >40% of trade recommendations result in user-submitted offers
- **Real-Time Value**: <2 minute average response time from injury announcement to user notification
- **Learning Effectiveness**: Measurable improvement in recommendation acceptance rate over course of season (week 1 vs week 12+)
- **Technical Performance**: 99.5% uptime during game windows (Thu/Sun/Mon)

---

## 2. Technical Architecture

### 2.1 Technology Stack

#### Frontend
- **Web Application**: Next.js 14+ (TypeScript, React Server Components)
- **Mobile Application**: React Native with Expo (Phase 2)
- **State Management**: Zustand or React Query for server state
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Real-time Updates**: WebSockets (Socket.io client)

#### Backend
- **API Server**: Node.js with Express/Fastify (TypeScript)
- **Compute Services**: Rust microservices for:
  - Trade evaluation algorithms
  - Waiver wire ranking calculations
  - Historical data processing
- **Real-time Monitoring**: Node.js service with WebSocket server
- **Task Scheduling**: Bull/BullMQ for weekly waiver processing

#### Data Layer
- **Primary Database**: PostgreSQL 15+
  - User accounts, league configurations
  - Historical transactions and decisions
  - Learned opponent profiles
- **Cache Layer**: Redis
  - Player projections and stats (short TTL)
  - Rate limiting for external APIs
  - Session management
- **Time-Series Data**: TimescaleDB extension for PostgreSQL
  - Weekly player performance tracking
  - Injury status history

#### Infrastructure
- **Hosting**: Vercel (frontend) + Railway/Render (backend services)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Monitoring**: Sentry (error tracking), Datadog/Grafana (metrics)
- **CI/CD**: GitHub Actions

### 2.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                         │
│  ┌──────────────┐              ┌──────────────┐         │
│  │   Next.js    │              │ React Native │         │
│  │  Web App     │              │  Mobile App  │         │
│  └──────┬───────┘              └──────┬───────┘         │
│         │                              │                 │
└─────────┼──────────────────────────────┼─────────────────┘
          │                              │
          └──────────────┬───────────────┘
                         │
          ┌──────────────▼───────────────┐
          │   API Gateway (Node.js)       │
          │   - Authentication            │
          │   - Rate Limiting             │
          │   - Request Routing           │
          └──────────────┬───────────────┘
                         │
          ┌──────────────┴───────────────┐
          │                              │
┌─────────▼─────────┐         ┌─────────▼──────────┐
│  Core API Server  │         │  Rust Compute      │
│  (TypeScript)     │◄────────┤  Services          │
│  - Business Logic │         │  - Trade Eval      │
│  - CRUD Ops       │         │  - Waiver Ranking  │
└─────────┬─────────┘         └────────────────────┘
          │
┌─────────▼─────────┐         ┌────────────────────┐
│ Real-Time Monitor │         │  Background Jobs   │
│ (Node.js)         │         │  (Bull Queue)      │
│ - WebSocket Srv   │         │  - Weekly Waiver   │
│ - Injury Polling  │         │  - Stats Refresh   │
│ - Push Notif      │         │  - ML Training     │
└─────────┬─────────┘         └────────────────────┘
          │
┌─────────▼─────────────────────────────────────────┐
│              Data Layer                            │
│  ┌──────────┐  ┌───────┐  ┌──────────────────┐   │
│  │PostgreSQL│  │ Redis │  │ External APIs    │   │
│  │(+Timescale)│ │ Cache │  │ - Sleeper        │   │
│  └──────────┘  └───────┘  │ - ESPN (unofficial)│ │
│                            │ - Stats APIs     │   │
│                            └──────────────────┘   │
└───────────────────────────────────────────────────┘
```

### 2.3 API Integration Strategy

#### Primary Fantasy Platform APIs

**Sleeper API (Recommended for MVP)**
- **Base URL**: `https://api.sleeper.app/v1/`
- **Authentication**: None required for read operations (user ID-based access)
- **Rate Limits**: ~1000 requests/minute
- **Key Endpoints**:
  - `GET /league/{league_id}` - League settings, scoring
  - `GET /league/{league_id}/rosters` - All rosters
  - `GET /league/{league_id}/transactions/{week}` - Trades, waivers, adds/drops
  - `GET /league/{league_id}/matchups/{week}` - Weekly matchups
  - `GET /players/nfl` - Complete player database (updated daily)
- **WebSocket**: Available for real-time updates
- **Refresh Strategy**: 
  - Player data: Daily at 3 AM ET
  - League transactions: Every 15 minutes during season
  - Injury status: Every 2 minutes during game windows

**ESPN API (Unofficial - Secondary Support)**
- **Library**: `espn-fantasy-football-api` (community maintained)
- **Authentication**: League ID + optional cookies for private leagues
- **Limitations**: Undocumented, subject to breaking changes
- **Use Case**: Support for users whose primary league is on ESPN

**Yahoo Fantasy API (Future Phase)**
- **Authentication**: OAuth 2.0 required
- **Complexity**: Higher integration effort, defer to Phase 2

#### Player Stats & Projections APIs

**Option 1: Sleeper Player Data (Free)**
- Includes basic projections and injury designations
- Updated daily, sufficient for MVP

**Option 2: FantasyData.com (Paid - $29-99/mo)**
- Professional-grade projections
- Real-time injury updates
- Historical performance data
- Consider for post-MVP if budget allows

**Option 3: SportRadar (Enterprise)**
- Most comprehensive, expensive
- Only if monetizing application

#### NFL Official Data
- **Injury Reports**: Scrape from NFL.com or use `nfl-api` library
- **Game Schedules**: Available via Sleeper, ESPN APIs
- **Live Game Status**: ESPN's public scoreboard API

### 2.4 Data Refresh & Caching Strategy

```
Player Projections (Redis TTL: 24 hours)
└─ Refresh: Daily at 3 AM ET

Injury Status (Redis TTL: 2 minutes during game windows, 1 hour otherwise)
└─ Refresh: 
   ├─ Every 2 minutes: Thu 6PM-11PM, Sun 12PM-11PM, Mon 6PM-11PM ET
   └─ Every 30 minutes: Other times during season

League Rosters (Redis TTL: 15 minutes)
└─ Refresh: On-demand + scheduled every 15 min during season

Transactions History (PostgreSQL, no cache)
└─ Append-only, fetch from API weekly after waivers clear

Opponent Learning Models (PostgreSQL)
└─ Retrain: After each transaction (async job)
```

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    push_token VARCHAR(500), -- FCM device token
    notification_preferences JSONB DEFAULT '{
        "injury_alerts": true,
        "trade_suggestions": true,
        "waiver_reminders": true,
        "auto_substitute": false
    }'
);

-- Connected Fantasy Leagues
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL, -- 'sleeper', 'espn', 'yahoo'
    platform_league_id VARCHAR(100) NOT NULL,
    league_name VARCHAR(200),
    team_name VARCHAR(200),
    platform_team_id VARCHAR(100),
    scoring_settings JSONB, -- full scoring configuration
    roster_settings JSONB, -- positions, bench size, etc.
    faab_budget INTEGER, -- starting FAAB or NULL if waiver priority
    current_faab INTEGER, -- remaining FAAB
    waiver_priority INTEGER,
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(platform, platform_league_id, platform_team_id)
);

-- Player Master Data (synced from APIs)
CREATE TABLE players (
    id VARCHAR(50) PRIMARY KEY, -- platform player ID
    full_name VARCHAR(200) NOT NULL,
    position VARCHAR(10) NOT NULL,
    team VARCHAR(10), -- NFL team abbreviation
    status VARCHAR(20), -- 'Active', 'Out', 'Questionable', 'Doubtful', 'IR'
    injury_designation VARCHAR(100),
    bye_week INTEGER,
    last_updated TIMESTAMP DEFAULT NOW(),
    metadata JSONB -- additional platform-specific data
);

-- Weekly Player Projections
CREATE TABLE player_projections (
    id BIGSERIAL PRIMARY KEY,
    player_id VARCHAR(50) REFERENCES players(id),
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    projected_points DECIMAL(6,2),
    projection_source VARCHAR(50), -- 'sleeper', 'fantasypro', etc.
    projection_confidence DECIMAL(3,2), -- 0.0 to 1.0
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, week, season, projection_source)
);

-- Time-series: Player Performance History
CREATE TABLE player_stats (
    time TIMESTAMPTZ NOT NULL,
    player_id VARCHAR(50) REFERENCES players(id),
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    actual_points DECIMAL(6,2),
    stats JSONB, -- detailed stat breakdown (rushing_yds, rec_tds, etc.)
    PRIMARY KEY (time, player_id)
);
SELECT create_hypertable('player_stats', 'time');

-- User's Current Roster (denormalized for performance)
CREATE TABLE rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    player_id VARCHAR(50) REFERENCES players(id),
    roster_slot VARCHAR(20), -- 'QB', 'RB', 'FLEX', 'BN', etc.
    is_starting BOOLEAN DEFAULT false,
    acquired_date DATE,
    acquisition_cost INTEGER, -- FAAB spent or NULL
    UNIQUE(league_id, player_id)
);

-- League Transactions (append-only audit log)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20), -- 'trade', 'waiver', 'free_agent'
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    involved_teams JSONB, -- array of team IDs
    players_moved JSONB, -- [{player_id, from_team, to_team, faab_cost}]
    proposer_team_id VARCHAR(100),
    status VARCHAR(20), -- 'proposed', 'accepted', 'rejected', 'completed'
    proposed_at TIMESTAMP,
    completed_at TIMESTAMP,
    platform_transaction_id VARCHAR(100),
    metadata JSONB
);

-- Trade Recommendations (generated by system)
CREATE TABLE trade_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    recommended_offer JSONB, -- {give: [player_ids], receive: [player_ids]}
    target_team_id VARCHAR(100), -- opponent team
    rationale TEXT,
    confidence_score DECIMAL(3,2), -- 0.0 to 1.0
    expected_value_gain DECIMAL(6,2), -- projected points improvement
    user_action VARCHAR(20), -- 'pending', 'accepted', 'rejected', 'sent'
    created_at TIMESTAMP DEFAULT NOW(),
    actioned_at TIMESTAMP
);

-- Waiver Recommendations
CREATE TABLE waiver_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    add_player_id VARCHAR(50) REFERENCES players(id),
    drop_player_id VARCHAR(50) REFERENCES players(id),
    recommended_bid INTEGER, -- FAAB amount or NULL for priority
    claim_priority INTEGER, -- if multiple claims, rank them
    rationale TEXT,
    confidence_score DECIMAL(3,2),
    positional_need_score DECIMAL(3,2),
    user_action VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    actioned_at TIMESTAMP
);

-- Opponent Behavior Profiles (learned over time)
CREATE TABLE opponent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    opponent_team_id VARCHAR(100) NOT NULL,
    position_preferences JSONB, -- {QB: 0.8, RB: 0.6, ...} likelihood to trade for
    trade_acceptance_rate DECIMAL(3,2), -- historical rate
    avg_faab_bid_pct DECIMAL(3,2), -- % of budget per bid
    risk_tolerance DECIMAL(3,2), -- 0=conservative, 1=aggressive
    trade_patterns JSONB, -- {prefers_handcuffs: true, values_upside: false}
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(league_id, opponent_team_id)
);

-- Injury Alerts Log
CREATE TABLE injury_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    player_id VARCHAR(50) REFERENCES players(id),
    game_time TIMESTAMPTZ,
    injury_status VARCHAR(20),
    alert_sent_at TIMESTAMP,
    auto_substitution_made BOOLEAN DEFAULT false,
    substituted_player_id VARCHAR(50) REFERENCES players(id),
    user_override BOOLEAN DEFAULT false,
    minutes_before_kickoff INTEGER
);
```

### 3.2 Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_rosters_league ON rosters(league_id);
CREATE INDEX idx_transactions_league_week ON transactions(league_id, week, season);
CREATE INDEX idx_player_projections_lookup ON player_projections(player_id, week, season);
CREATE INDEX idx_players_status ON players(status) WHERE status IN ('Out', 'Questionable', 'Doubtful');
CREATE INDEX idx_injury_alerts_game_time ON injury_alerts(game_time) WHERE alert_sent_at IS NULL;
```

---

## 4. Core Feature Specifications

### 4.1 Trade Analyzer & Recommendations

#### 4.1.1 Objectives
- Identify players on user's roster performing above projection (sell-high candidates)
- Identify underperforming players on opponent rosters (buy-low targets)
- Generate trade packages that improve user's projected season-long points while appearing fair to opponents
- Learn opponent preferences to increase trade acceptance likelihood

#### 4.1.2 Algorithm Design

**Step 1: Identify Sell-High Candidates**
```typescript
interface SellHighMetrics {
    playerId: string;
    avgActualPoints: number;
    avgProjectedPoints: number;
    performanceRatio: number; // actual / projected
    weeksAboveProjection: number;
    standardDeviationAbove: number;
    trendDirection: 'up' | 'down' | 'stable';
}

function identifySellHighCandidates(roster: Player[]): SellHighMetrics[] {
    return roster
        .filter(player => player.weeksPlayed >= 3) // minimum sample
        .map(player => ({
            playerId: player.id,
            avgActualPoints: calculateAverage(player.actualPoints),
            avgProjectedPoints: calculateAverage(player.projectedPoints),
            performanceRatio: calculateRatio(player),
            weeksAboveProjection: countWeeksAbove(player),
            standardDeviationAbove: calculateZScore(player),
            trendDirection: detectTrend(player.recentGames, 3)
        }))
        .filter(m => m.performanceRatio > 1.15) // 15% above projection
        .filter(m => m.standardDeviationAbove > 0.5) // statistical significance
        .sort((a, b) => b.performanceRatio - a.performanceRatio);
}
```

**Step 2: Identify Buy-Low Targets**
```typescript
interface BuyLowMetrics {
    playerId: string;
    ownerTeamId: string;
    avgActualPoints: number;
    restOfSeasonProjection: number;
    currentValueDiscount: number; // how much below ROS projection
    injuryRisk: number; // 0.0 to 1.0
    scheduleStrength: number; // remaining schedule difficulty
}

function identifyBuyLowTargets(leagueRosters: TeamRoster[]): BuyLowMetrics[] {
    const allPlayers = leagueRosters.flatMap(r => r.players);
    
    return allPlayers
        .filter(p => p.weeksPlayed >= 3)
        .map(player => ({
            playerId: player.id,
            ownerTeamId: player.teamId,
            avgActualPoints: calculateAverage(player.actualPoints),
            restOfSeasonProjection: calculateROSProjection(player),
            currentValueDiscount: calculateDiscount(player),
            injuryRisk: assessInjuryRisk(player),
            scheduleStrength: analyzeRemainingSchedule(player)
        }))
        .filter(m => m.currentValueDiscount > 0.2) // 20% undervalued
        .filter(m => m.injuryRisk < 0.3) // not injury-prone
        .sort((a, b) => b.currentValueDiscount - a.currentValueDiscount);
}
```

**Step 3: Generate Trade Packages**
```typescript
interface TradePackage {
    give: string[]; // player IDs
    receive: string[]; // player IDs
    targetTeamId: string;
    valueGainForUser: number; // projected points over season
    valueChangeForOpponent: number; // ideally near 0 or slight positive
    fairnessScore: number; // 0.0 to 1.0, how balanced the trade appears
    acceptanceProbability: number; // based on opponent profile
    rationale: string;
}

function generateTradePackages(
    sellHighCandidates: SellHighMetrics[],
    buyLowTargets: BuyLowMetrics[],
    opponentProfiles: OpponentProfile[]
): TradePackage[] {
    const packages: TradePackage[] = [];
    
    for (const sellHigh of sellHighCandidates) {
        for (const buyLow of buyLowTargets) {
            // Simple 1-for-1 trade
            const simplePackage = evaluateTrade(
                [sellHigh.playerId],
                [buyLow.playerId],
                buyLow.ownerTeamId,
                opponentProfiles
            );
            
            if (simplePackage.valueGainForUser > 0 && 
                simplePackage.fairnessScore > 0.6) {
                packages.push(simplePackage);
            }
            
            // 2-for-1 and 2-for-2 packages
            // (Similar logic with additional complexity balancing)
        }
    }
    
    return packages
        .filter(p => p.acceptanceProbability > 0.25)
        .sort((a, b) => b.valueGainForUser - a.valueGainForUser)
        .slice(0, 5); // Top 5 recommendations per week
}
```

**Step 4: Opponent Learning Model (Rust Implementation)**
```rust
// Simplified Rust pseudo-code for opponent tendency learning
struct OpponentModel {
    team_id: String,
    position_weights: HashMap<Position, f64>,
    risk_tolerance: f64,
    historical_trades: Vec<TradeRecord>,
}

impl OpponentModel {
    fn update_from_transaction(&mut self, transaction: &Transaction) {
        // Bayesian update of position preferences
        if transaction.accepted {
            for player in &transaction.players_received {
                let current_weight = self.position_weights
                    .entry(player.position)
                    .or_insert(0.5);
                *current_weight = (*current_weight * 0.9) + (0.1 * 1.0);
            }
        }
        
        // Update risk tolerance based on player types acquired
        self.risk_tolerance = calculate_risk_score(&transaction);
    }
    
    fn predict_acceptance(&self, trade: &TradePackage) -> f64 {
        let position_score = self.evaluate_position_fit(trade);
        let value_score = self.evaluate_value_perception(trade);
        let risk_score = self.evaluate_risk_alignment(trade);
        
        // Weighted combination
        (position_score * 0.4) + (value_score * 0.4) + (risk_score * 0.2)
    }
}
```

#### 4.1.3 User Interface Flow

1. **Dashboard View**
   - Card showing "Top Trade Opportunities (Week X)"
   - Display top 3 recommended trades with:
     - Visual player cards (photo, name, position, team)
     - Arrow showing direction (You give → You receive)
     - Expected value gain: "+X.X pts/week ROS"
     - Acceptance probability indicator (Low/Medium/High)
     - Rationale summary (2-3 sentences)

2. **Trade Detail Modal**
   - Full breakdown of projection changes
   - Roster composition before/after
   - Positional needs addressed
   - Bye week coverage impact
   - "Send Trade Offer" CTA → Deep link to platform (since API can't send)
   - "Dismiss" or "Not Interested" (learns from rejection)

3. **Learning Feedback Loop**
   - Track which recommendations user sends
   - Track acceptance/rejection from league transaction history
   - Update opponent models weekly

#### 4.1.4 API Endpoints

```typescript
// GET /api/trades/recommendations?leagueId={id}&week={week}
interface TradeRecommendationsResponse {
    recommendations: TradePackage[];
    lastUpdated: string;
    nextUpdateAt: string;
}

// POST /api/trades/feedback
interface TradeFeedbackRequest {
    recommendationId: string;
    action: 'sent' | 'dismissed' | 'accepted' | 'rejected';
}

// GET /api/trades/history?leagueId={id}
interface TradeHistoryResponse {
    trades: Transaction[];
    userInitiated: number;
    acceptanceRate: number;
}
```

---

### 4.2 Waiver Wire Optimization

#### 4.2.1 Objectives
- Identify high-value waiver wire targets based on projected breakouts, injuries to starters, and positional needs
- Recommend optimal FAAB bid amounts or claim priority ranking
- Account for roster construction and bench depth
- Learn league-specific bidding patterns

#### 4.2.2 Algorithm Design

**Step 1: Target Identification**
```typescript
interface WaiverTarget {
    playerId: string;
    projectedROSPoints: number;
    opportunityScore: number; // change in role/usage
    ownershipPct: number;
    addTrend: number; // # adds across fantasy platforms
    injuryBenefit: boolean; // beneficiary of teammate injury?
    scheduleStrength: number;
}

function identifyWaiverTargets(
    availablePlayers: Player[],
    userRoster: Player[],
    week: number
): WaiverTarget[] {
    return availablePlayers
        .filter(p => p.ownershipPct < 75) // not universally owned
        .map(player => ({
            playerId: player.id,
            projectedROSPoints: calculateROSProjection(player, week),
            opportunityScore: assessOpportunityChange(player), // key metric
            ownershipPct: player.ownershipPct,
            addTrend: getAddTrend(player, 7), // last 7 days
            injuryBenefit: checkDepthChartMovement(player),
            scheduleStrength: analyzeRemainingSchedule(player)
        }))
        .filter(t => t.opportunityScore > 0.3) // significant role change
        .sort((a, b) => b.projectedROSPoints - a.projectedROSPoints);
}
```

**Step 2: Roster Need Analysis**
```typescript
interface PositionalNeed {
    position: string;
    currentDepth: number;
    avgProjectedPoints: number;
    upcomingByes: number[]; // weeks with bye
    injuryRisk: number;
    needScore: number; // 0.0 to 1.0
}

function analyzeRosterNeeds(roster: Player[]): PositionalNeed[] {
    const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX'];
    
    return positions.map(pos => {
        const playersAtPosition = roster.filter(p => canFill(p, pos));
        const upcomingByes = playersAtPosition
            .map(p => p.byeWeek)
            .filter(w => w > currentWeek);
        
        return {
            position: pos,
            currentDepth: playersAtPosition.length,
            avgProjectedPoints: calculateAverage(
                playersAtPosition.map(p => p.restOfSeasonProjection)
            ),
            upcomingByes,
            injuryRisk: calculateCombinedInjuryRisk(playersAtPosition),
            needScore: calculateNeedScore(playersAtPosition, pos)
        };
    }).sort((a, b) => b.needScore - a.needScore);
}
```

**Step 3: FAAB Bid Optimization**
```typescript
interface FAABRecommendation {
    addPlayerId: string;
    dropPlayerId: string;
    recommendedBid: number;
    bidRange: { min: number; max: number };
    winProbability: number;
    valueOverReplacement: number;
    rationale: string;
}

function calculateOptimalBid(
    target: WaiverTarget,
    leagueBiddingHistory: Transaction[],
    currentFAAB: number,
    positionalNeed: number
): FAABRecommendation {
    // Historical bid analysis for similar players
    const similarPlayerBids = leagueBiddingHistory
        .filter(t => t.playerAdded.position === target.position)
        .filter(t => t.playerAdded.ownershipPct < target.ownershipPct + 10)
        .map(t => t.faabCost);
    
    const medianHistoricalBid = calculateMedian(similarPlayerBids);
    const stdDev = calculateStdDev(similarPlayerBids);
    
    // Base bid on historical patterns
    let baseBid = medianHistoricalBid;
    
    // Adjust for player value
    const valueMultiplier = 1 + (target.opportunityScore * 0.5);
    baseBid *= valueMultiplier;
    
    // Adjust for positional need
    baseBid *= (1 + positionalNeed * 0.3);
    
    // Adjust for add trend (urgency)
    if (target.addTrend > 20) baseBid *= 1.2; // hot waiver
    
    // Cap at reasonable % of remaining FAAB
    const maxRecommendedBid = Math.min(
        baseBid,
        currentFAAB * 0.4 // never recommend more than 40% of budget
    );
    
    return {
        addPlayerId: target.playerId,
        dropPlayerId: findDropCandidate(roster, target.position),
        recommendedBid: Math.round(maxRecommendedBid),
        bidRange: {
            min: Math.round(maxRecommendedBid * 0.7),
            max: Math.round(maxRecommendedBid * 1.3)
        },
        winProbability: estimateWinProbability(maxRecommendedBid, similarPlayerBids),
        valueOverReplacement: calculateVORP(target, roster),
        rationale: generateRationale(target, positionalNeed)
    };
}
```

**Step 4: Waiver Priority System**
```typescript
// For leagues using waiver priority instead of FAAB
interface WaiverClaim {
    priority: number; // 1 = submit first
    addPlayerId: string;
    dropPlayerId: string;
    value: number;
    rationale: string;
}

function prioritizeWaiverClaims(
    targets: WaiverTarget[],
    rosterNeeds: PositionalNeed[],
    currentPriority: number
): WaiverClaim[] {
    // Score each target
    const scoredTargets = targets.map(target => {
        const posNeed = rosterNeeds.find(n => n.position === target.position);
        const score = (
            target.projectedROSPoints * 0.4 +
            target.opportunityScore * 100 * 0.3 +
            (posNeed?.needScore || 0) * 100 * 0.3
        );
        
        return { target, score };
    });
    
    // Sort by score and create priority order
    return scoredTargets
        .sort((a, b) => b.score - a.score)
        .map((st, index) => ({
            priority: index + 1,
            addPlayerId: st.target.playerId,
            dropPlayerId: findDropCandidate(roster, st.target.position),
            value: st.score,
            rationale: generateRationale(st.target, rosterNeeds)
        }))
        .slice(0, 5); // Recommend top 5 claims
}
```

#### 4.2.3 User Interface Flow

1. **Waiver Dashboard (Available Tuesday Evening - Wednesday)**
   - Section: "Top Waiver Targets This Week"
   - Display grid of recommended adds (3-5 players)
   - For each target show:
     - Player card with stats
     - "Why now?" callout (injury to starter, usage spike, etc.)
     - Recommended bid amount or claim priority
     - Suggested drop candidate from bench
     - Value over replacement metric

2. **FAAB Slider (for FAAB leagues)**
   - Interactive slider showing bid range
   - Win probability indicator that updates as slider moves
   - "Conservative" / "Recommended" / "Aggressive" markers
   - Budget remaining display

3. **Claim Priority List (for priority leagues)**
   - Draggable list to reorder claims
   - System recommendations indicated
   - Explanation for each priority rank

4. **Confirmation Flow**
   - Review all claims before submission
   - "Set in platform" CTA (deep link to league)
   - Option to schedule reminder for waiver processing time

#### 4.2.4 API Endpoints

```typescript
// GET /api/waivers/targets?leagueId={id}&week={week}
interface WaiverTargetsResponse {
    targets: WaiverTarget[];
    rosterNeeds: PositionalNeed[];
    recommendations: FAABRecommendation[] | WaiverClaim[];
}

// POST /api/waivers/customize
interface WaiverCustomizeRequest {
    targetPlayerId: string;
    customBid?: number;
    customPriority?: number;
}

// GET /api/waivers/history?leagueId={id}
interface WaiverHistoryResponse {
    bids: Transaction[];
    avgBidByPosition: Record<string, number>;
    successRate: number;
}
```

---

### 4.3 Real-Time Injury Monitoring & Auto-Substitution

#### 4.3.1 Objectives
- Monitor player injury status changes in real-time during game windows
- Alert user via push notification within 10 minutes of kickoff if starter ruled Out
- Recommend or automatically substitute best available bench player
- Minimize risk of starting inactive players

#### 4.3.2 Technical Implementation

**Real-Time Monitoring Service (Node.js)**
```typescript
class InjuryMonitorService {
    private activeMonitors: Map<string, NodeJS.Timer> = new Map();
    
    startGameWindowMonitoring(gameWindow: GameWindow) {
        const games = getGamesInWindow(gameWindow); // Thu/Sun/Mon games
        
        games.forEach(game => {
            const monitorKey = `${game.id}-${game.startTime}`;
            
            // Start monitoring 2 hours before kickoff
            const startMonitorAt = game.startTime.subtract(2, 'hours');
            
            const interval = setInterval(async () => {
                const now = new Date();
                const minutesToKickoff = differenceInMinutes(game.startTime, now);
                
                if (minutesToKickoff < 0) {
                    // Game started, stop monitoring
                    this.stopMonitor(monitorKey);
                    return;
                }
                
                // Check injury status for all players in this game
                await this.checkPlayerStatus(game);
                
                // Poll every 2 minutes when >30 min to kickoff
                // Poll every 1 minute when <=30 min to kickoff
                const pollInterval = minutesToKickoff > 30 ? 120000 : 60000;
                
            }, 60000); // Initial 1 min interval, adjust dynamically
            
            this.activeMonitors.set(monitorKey, interval);
        });
    }
    
    async checkPlayerStatus(game: Game) {
        const affectedUsers = await this.getAffectedUsers(game);
        
        for (const user of affectedUsers) {
            const startingPlayers = await this.getStartingLineup(
                user.leagueId,
                game.id
            );
            
            for (const player of startingPlayers) {
                const currentStatus = await this.getPlayerStatus(player.id);
                
                if (currentStatus.status === 'Out' && 
                    player.lastKnownStatus !== 'Out') {
                    
                    const minutesToKickoff = this.getMinutesToKickoff(
                        game.startTime
                    );
                    
                    if (minutesToKickoff <= 10) {
                        await this.handleInjuryAlert(
                            user,
                            player,
                            game,
                            minutesToKickoff
                        );
                    }
                }
            }
        }
    }
    
    async handleInjuryAlert(
        user: User,
        player: Player,
        game: Game,
        minutesToKickoff: number
    ) {
        // Find best bench replacement
        const replacement = await this.findBestReplacement(
            user.leagueId,
            player.position,
            game.startTime
        );
        
        // Log alert
        await db.injuryAlerts.create({
            leagueId: user.leagueId,
            playerId: player.id,
            gameTime: game.startTime,
            injuryStatus: 'Out',
            alertSentAt: new Date(),
            minutesBeforeKickoff: minutesToKickoff,
            substitutedPlayerId: replacement?.id
        });
        
        // Check user preference
        if (user.notificationPreferences.auto_substitute && replacement) {
            // Auto-substitute (note: can't actually change via API)
            // So we'll send urgent notification with clear instructions
            await this.sendAutoSubAlert(user, player, replacement, minutesToKickoff);
        } else {
            // Send recommendation notification
            await this.sendInjuryAlert(user, player, replacement, minutesToKickoff);
        }
    }
}
```

**Replacement Selection Algorithm**
```typescript
interface ReplacementCandidate {
    playerId: string;
    projectedPoints: number;
    gameStartTime: Date;
    hasAlreadyPlayed: boolean;
    eligibleForSlot: boolean;
}

async function findBestReplacement(
    leagueId: string,
    injuredPlayerPosition: string,
    gameTime: Date
): Promise<Player | null> {
    const roster = await getRoster(leagueId);
    const benchPlayers = roster.filter(p => p.rosterSlot === 'BN');
    
    const candidates: ReplacementCandidate[] = benchPlayers
        .filter(p => canFillPosition(p.position, injuredPlayerPosition))
        .map(p => ({
            playerId: p.id,
            projectedPoints: p.weekProjection,
            gameStartTime: p.gameStartTime,
            hasAlreadyPlayed: p.gameStartTime < new Date(),
            eligibleForSlot: true
        }))
        .filter(c => !c.hasAlreadyPlayed); // Can't sub in players who already played
    
    if (candidates.length === 0) return null;
    
    // Prioritize:
    // 1. Plays in later game (more flex)
    // 2. Higher projected points
    const sorted = candidates.sort((a, b) => {
        // Later game = better (more options if another injury)
        if (a.gameStartTime > b.gameStartTime) return -1;
        if (a.gameStartTime < b.gameStartTime) return 1;
        
        // Tie-breaker: projected points
        return b.projectedPoints - a.projectedPoints;
    });
    
    const bestCandidate = sorted[0];
    return await getPlayer(bestCandidate.playerId);
}
```

**Push Notification Service**
```typescript
import admin from 'firebase-admin';

async function sendInjuryAlert(
    user: User,
    injuredPlayer: Player,
    replacement: Player | null,
    minutesToKickoff: number
) {
    if (!user.pushToken) return;
    
    const urgencyLevel = minutesToKickoff < 5 ? 'critical' : 'high';
    
    const message: admin.messaging.Message = {
        token: user.pushToken,
        notification: {
            title: `🚨 ${injuredPlayer.fullName} ruled OUT!`,
            body: replacement 
                ? `Tap to sub in ${replacement.fullName} (${minutesToKickoff} min to kickoff)`
                : `No bench replacement available (${minutesToKickoff} min to kickoff)`,
        },
        data: {
            type: 'injury_alert',
            leagueId: user.leagueId,
            injuredPlayerId: injuredPlayer.id,
            replacementPlayerId: replacement?.id || '',
            minutesToKickoff: minutesToKickoff.toString(),
            urgency: urgencyLevel
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'injury_alerts',
                priority: 'max'
            }
        },
        apns: {
            headers: {
                'apns-priority': '10',
                'apns-interruption-level': urgencyLevel
            },
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };
    
    try {
        await admin.messaging().send(message);
        console.log(`Injury alert sent to user ${user.id}`);
    } catch (error) {
        console.error('Failed to send injury alert:', error);
    }
}
```

#### 4.3.3 User Interface Flow

1. **Push Notification**
   - Urgent tone with injury icon
   - Player name + "ruled OUT"
   - Recommended replacement if available
   - Deep link to app's lineup page

2. **In-App Alert Screen**
   - Large "URGENT" banner
   - Countdown timer to kickoff
   - Side-by-side comparison:
     - OUT player (grayed out)
     - Recommended replacement (highlighted)
   - Single-tap "Make Substitution" button
     - Opens platform app with pre-filled lineup change (if API allows)
     - Otherwise, shows clear instructions

3. **Settings/Preferences**
   - Toggle: "Enable injury alerts"
   - Toggle: "Auto-substitute (with confirmation)" vs "Recommend only"
   - Notification timing: "Alert me when < X minutes to kickoff"
   - Test notification button

#### 4.3.4 Game Window Monitoring Schedule

```typescript
const GAME_WINDOWS = {
    THURSDAY: {
        days: [4], // Thursday
        startHour: 18, // 6 PM ET monitoring start
        endHour: 23
    },
    SUNDAY_EARLY: {
        days: [0], // Sunday
        startHour: 11, // 11 AM ET
        endHour: 14
    },
    SUNDAY_LATE: {
        days: [0],
        startHour: 14,
        endHour: 17
    },
    SUNDAY_NIGHT: {
        days: [0],
        startHour: 18,
        endHour: 23
    },
    MONDAY: {
        days: [1],
        startHour: 18,
        endHour: 23
    }
};

// Cron job to start/stop monitoring
cron.schedule('0 * * * *', async () => { // Every hour
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    
    for (const [window, config] of Object.entries(GAME_WINDOWS)) {
        if (config.days.includes(currentDay) && 
            currentHour >= config.startHour && 
            currentHour <= config.endHour) {
            
            await injuryMonitorService.startGameWindowMonitoring(window);
        }
    }
});
```

#### 4.3.5 API Endpoints

```typescript
// GET /api/injuries/active-alerts?leagueId={id}
interface ActiveAlertsResponse {
    alerts: InjuryAlert[];
    activeGames: Game[];
}

// POST /api/injuries/handle-substitution
interface SubstitutionRequest {
    alertId: string;
    action: 'substitute' | 'dismiss';
    replacementPlayerId?: string;
}

// POST /api/injuries/preferences
interface InjuryPreferencesRequest {
    autoSubstitute: boolean;
    alertThresholdMinutes: number;
    enableAlerts: boolean;
}
```

---

### 4.4 Learning System & Opponent Modeling

#### 4.4.1 Objectives
- Continuously improve recommendations based on league-specific patterns
- Model opponent behavior to increase trade acceptance rates
- Adapt waiver bid recommendations based on league bidding history
- Provide transparency into what the system has learned

#### 4.4.2 Data Collection

**Transaction Monitoring**
```typescript
// Background job runs every 15 minutes during season
async function syncLeagueTransactions(leagueId: string) {
    const league = await db.leagues.findUnique({ where: { id: leagueId } });
    const currentWeek = getCurrentWeek();
    
    // Fetch transactions from platform API
    const platformTransactions = await sleeper.getTransactions(
        league.platformLeagueId,
        currentWeek
    );
    
    for (const txn of platformTransactions) {
        // Check if we've already recorded this transaction
        const exists = await db.transactions.findUnique({
            where: { platformTransactionId: txn.transaction_id }
        });
        
        if (!exists) {
            // New transaction - record it
            await db.transactions.create({
                data: {
                    leagueId,
                    transactionType: txn.type,
                    week: currentWeek,
                    season: 2026,
                    involvedTeams: txn.roster_ids,
                    playersMoved: txn.adds ? Object.entries(txn.adds).map(([playerId, teamId]) => ({
                        playerId,
                        toTeam: teamId,
                        faabCost: txn.settings?.waiver_bid || null
                    })) : [],
                    status: txn.status,
                    completedAt: txn.status_updated,
                    platformTransactionId: txn.transaction_id
                }
            });
            
            // Update opponent profiles if trade
            if (txn.type === 'trade') {
                await updateOpponentProfiles(leagueId, txn);
            }
        }
    }
}
```

**Opponent Profile Updates**
```typescript
async function updateOpponentProfiles(
    leagueId: string,
    transaction: Transaction
) {
    if (transaction.transactionType !== 'trade') return;
    
    for (const teamId of transaction.involvedTeams) {
        let profile = await db.opponentProfiles.findUnique({
            where: {
                leagueId_opponentTeamId: {
                    leagueId,
                    opponentTeamId: teamId
                }
            }
        });
        
        if (!profile) {
            profile = await db.opponentProfiles.create({
                data: {
                    leagueId,
                    opponentTeamId: teamId,
                    positionPreferences: {},
                    tradeAcceptanceRate: 0.5,
                    avgFaabBidPct: 0.05,
                    riskTolerance: 0.5,
                    tradePatterns: {}
                }
            });
        }
        
        // Update position preferences
        const playersReceived = transaction.playersMoved.filter(
            p => p.toTeam === teamId
        );
        
        for (const player of playersReceived) {
            const playerData = await getPlayer(player.playerId);
            const currentPref = profile.positionPreferences[playerData.position] || 0.5;
            
            // Exponential moving average
            profile.positionPreferences[playerData.position] = 
                currentPref * 0.8 + 0.2 * 1.0;
        }
        
        // Update trade acceptance rate
        const totalTrades = await db.transactions.count({
            where: {
                leagueId,
                involvedTeams: { has: teamId },
                transactionType: 'trade'
            }
        });
        
        const acceptedTrades = await db.transactions.count({
            where: {
                leagueId,
                involvedTeams: { has: teamId },
                transactionType: 'trade',
                status: 'complete'
            }
        });
        
        profile.tradeAcceptanceRate = acceptedTrades / totalTrades;
        
        // Update risk tolerance based on player types
        const riskScore = calculateRiskScore(playersReceived);
        profile.riskTolerance = profile.riskTolerance * 0.9 + riskScore * 0.1;
        
        await db.opponentProfiles.update({
            where: { id: profile.id },
            data: profile
        });
    }
}
```

**User Feedback Learning**
```typescript
async function recordRecommendationFeedback(
    recommendationId: string,
    action: 'accepted' | 'rejected' | 'sent' | 'dismissed'
) {
    const recommendation = await db.tradeRecommendations.findUnique({
        where: { id: recommendationId }
    });
    
    await db.tradeRecommendations.update({
        where: { id: recommendationId },
        data: {
            userAction: action,
            actionedAt: new Date()
        }
    });
    
    // If user consistently rejects certain types of trades, learn from it
    if (action === 'rejected' || action === 'dismissed') {
        await updateUserPreferences(recommendation);
    }
}

async function updateUserPreferences(recommendation: TradeRecommendation) {
    // Example: User consistently rejects trades involving their QB
    // Store this as a soft constraint for future recommendations
    const rejectedPlayers = recommendation.recommendedOffer.give;
    
    // This could be expanded into a more sophisticated preference model
}
```

#### 4.4.3 Model Retraining

**Weekly Model Updates (Background Job)**
```typescript
// Runs Sunday night after all games complete
cron.schedule('0 2 * * 1', async () => { // 2 AM Monday
    const activeLeagues = await db.leagues.findMany({
        where: { isActive: true }
    });
    
    for (const league of activeLeagues) {
        await retrainLeagueModels(league.id);
    }
});

async function retrainLeagueModels(leagueId: string) {
    console.log(`Retraining models for league ${leagueId}`);
    
    // 1. Update opponent profiles from latest transactions
    const recentTransactions = await db.transactions.findMany({
        where: {
            leagueId,
            completedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
        }
    });
    
    for (const txn of recentTransactions) {
        await updateOpponentProfiles(leagueId, txn);
    }
    
    // 2. Update waiver bid models
    const waiverHistory = await db.transactions.findMany({
        where: {
            leagueId,
            transactionType: 'waiver'
        }
    });
    
    await updateWaiverBidModel(leagueId, waiverHistory);
    
    // 3. Validate model accuracy
    const accuracy = await validateModelPredictions(leagueId);
    console.log(`Model accuracy for league ${leagueId}: ${accuracy}`);
}
```

#### 4.4.4 Transparency Features

**"What I've Learned" Dashboard**
```typescript
// User-facing insights into learned patterns
interface LeagueInsights {
    opponentTendencies: {
        teamId: string;
        teamName: string;
        mostLikelyToTradeFor: string[]; // positions
        tradeActivityLevel: 'low' | 'medium' | 'high';
        avgFaabSpend: number;
    }[];
    waiverPatterns: {
        avgBidByPosition: Record<string, number>;
        competitivePositions: string[];
        yourSuccessRate: number;
    };
    recommendationPerformance: {
        tradesSuggested: number;
        tradesSent: number;
        tradesAccepted: number;
        avgPointsGained: number;
    };
}

// GET /api/insights?leagueId={id}
async function getLeagueInsights(leagueId: string): Promise<LeagueInsights> {
    // Aggregate learned patterns for user visibility
    // This builds trust and helps users understand the AI's reasoning
}
```

---

## 5. Development Phases & Timeline

### 5.1 Phase 1 - MVP (Target: April 2026)

**Duration:** 16 weeks (January - April 2026)

**Scope:**
- User authentication & league connection (Sleeper only)
- Basic roster syncing and data pipeline
- Trade analyzer with sell-high/buy-low identification
- Simple trade package generation (1-for-1 and 2-for-2)
- Waiver wire target identification
- FAAB bid recommendations
- Basic opponent modeling (position preferences only)
- Web application (Next.js)

**Deliverables:**
- Functional web app with core features
- PostgreSQL database fully set up
- Sleeper API integration complete
- Basic ML models for projections
- Test coverage >70%

**Success Criteria:**
- Can successfully connect to Sleeper league
- Generate at least 3 trade recommendations per week
- Provide waiver targets with bid amounts
- Load time <2 seconds for all pages

---

### 5.2 Phase 2 - Real-Time Features (Target: June 2026)

**Duration:** 8 weeks (May - June 2026)

**Scope:**
- Real-time injury monitoring service
- Push notification infrastructure (FCM)
- Auto-substitution recommendations
- Lineup optimization (best ball calculations)
- Injury risk scoring and de-risking recommendations
- Enhanced opponent learning (trade patterns, risk tolerance)
- Mobile app development begins (React Native)

**Deliverables:**
- Injury alert system fully functional
- Push notifications working on web and mobile
- Background monitoring services deployed
- Mobile app beta (iOS/Android)

**Success Criteria:**
- <2 minute notification delay from injury announcement
- 95%+ notification delivery rate
- Accurate replacement recommendations 80%+ of time

---

### 5.3 Phase 3 - Polish & Launch (Target: August 2026)

**Duration:** 8 weeks (July - August)

**Scope:**
- ESPN API integration (secondary platform support)
- Advanced ML models (Rust implementations)
- Sophisticated trade valuations (multi-player packages)
- League insights dashboard
- User customization & preferences
- Performance optimization
- Security audit
- Beta testing with 20-50 users

**Deliverables:**
- Production-ready application
- Multi-platform support (Sleeper + ESPN)
- Comprehensive test suite
- Documentation complete
- Mobile apps submitted to stores

**Success Criteria:**
- Support 100+ concurrent users
- Zero data loss incidents
- <500ms average API response time
- App store approval

---

### 5.4 Post-Launch Enhancements (Fall 2026+)

**Future Features:**
- Yahoo Fantasy integration
- Dynasty league support (multi-year projections)
- Best ball tournament optimization
- League comparison / benchmarking
- Social features (share trades, discuss recommendations)
- Browser extension for in-platform integration
- Premium tier with advanced analytics

---

## 6. Technical Considerations & Risks

### 6.1 API Limitations & Mitigation

**Risk:** Fantasy platforms may change or restrict API access

**Mitigation:**
- Build abstraction layer for platform APIs (adapter pattern)
- Store historical data locally to reduce dependency
- Monitor community forums for API changes
- Have fallback manual data entry option

---

### 6.2 Real-Time Infrastructure Costs

**Risk:** Continuous monitoring during game windows is compute-intensive

**Mitigation:**
- Use serverless functions for monitoring (pay per execution)
- Implement intelligent polling (slow when far from game time, fast when close)
- Cache player status data aggressively
- Consider dedicated server only during NFL season

**Estimated Costs (Monthly during season):**
- Hosting (Railway/Render): $25-50
- Database (Postgres): $15-25
- Redis cache: $10
- FCM (push notifications): Free tier sufficient for <1M notifications
- **Total: ~$50-85/month during season, ~$20/month off-season**

---

### 6.3 Machine Learning Model Accuracy

**Risk:** Recommendations may be poor early in season due to limited data

**Mitigation:**
- Start with consensus expert projections (FantasyPros API)
- Use prior season data as baseline
- Be transparent with users about confidence levels
- Allow manual overrides for all recommendations
- Improve over course of season as league-specific data accumulates

---

### 6.4 Legal & Terms of Service

**Risk:** Platform APIs may have ToS restrictions

**Mitigation:**
- Review Sleeper, ESPN, Yahoo ToS carefully
- Only use publicly accessible data
- Don't scrape at excessive rates
- Clearly state in app that users are responsible for manual league actions
- Consider reaching out to platforms for partnership/approval

---

### 6.5 Data Privacy & Security

**Risk:** Handling user league data and credentials

**Mitigation:**
- Never store platform passwords (use OAuth where available)
- Encrypt sensitive data at rest
- Implement row-level security in database
- Regular security audits
- GDPR/CCPA compliance (data export, deletion)
- Clear privacy policy

---

## 7. Success Metrics & KPIs

### 7.1 User Engagement

- **DAU during season:** Target >60% of registered users
- **Weekly active users:** Target >85%
- **Average session duration:** Target >5 minutes
- **Feature adoption rates:**
  - Trade recommendations viewed: >70%
  - Waiver recommendations used: >50%
  - Injury alerts enabled: >80%

### 7.2 Product Performance

- **Trade acceptance rate:** Track recommendations that lead to accepted trades
- **Waiver success rate:** % of recommended bids that successfully acquire player
- **Notification delivery:** >95% delivered within 2 minutes
- **System uptime:** >99.5% during game windows

### 7.3 Technical Metrics

- **API response time:** p95 <500ms
- **Database query time:** p95 <100ms
- **Error rate:** <0.1% of requests
- **Cache hit rate:** >80% for player data

---

## 8. Open Questions & Decisions Needed

1. **Monetization Strategy:**
   - Free tier with basic features?
   - Premium subscription for advanced analytics?
   - One-time purchase per season?

2. **Platform Priority:**
   - Start with Sleeper only and add ESPN later?
   - Or support both from launch?

3. **Mobile vs Web Priority:**
   - Build web first, mobile second?
   - Or concurrent development?

4. **Trade Execution:**
   - Accept that users must manually enter trades?
   - Or attempt unofficial API calls (risky)?

5. **Data Sources:**
   - Pay for premium projections (FantasyData) or use free (Sleeper)?
   - What's the budget?

6. **Scope Creep Prevention:**
   - How to say "no" to feature requests during development?
   - What's the absolute MVP cutoff?

---

## 9. Appendix

### 9.1 Technology Justifications

**TypeScript:**
- Type safety reduces bugs in complex data transformations
- Excellent ecosystem for web/API development
- Works across frontend and backend
- Great tooling and DX

**Rust:**
- Performance-critical algorithms (trade evaluation, waiver ranking)
- Can be called from Node.js via FFI
- Memory safety without garbage collection
- Will looks impressive on resume for systems programming roles

**Next.js:**
- Full-stack framework (API routes + frontend)
- Server-side rendering for SEO and performance
- Excellent developer experience
- Easy deployment on Vercel

**PostgreSQL:**
- Robust relational data model
- JSONB for flexible schemas (player stats, transaction metadata)
- TimescaleDB extension for time-series data
- Better query capabilities than NoSQL for this use case

**React Native:**
- Code sharing with web app
- Native performance
- Expo for simplified development

### 9.2 Alternative Approaches Considered

**Why not Python for backend?**
- Considered, but TypeScript gives better end-to-end type safety
- Rust can handle compute-heavy tasks
- Node.js has better real-time capabilities (WebSockets)

**Why not MongoDB?**
- Relational model is better fit for league/roster structure
- Postgres JSONB gives flexibility where needed
- Better query optimization for complex joins

**Why not Flutter for mobile?**
- Less code reuse with existing TypeScript/React codebase
- React Native allows sharing business logic

---

## 10. Getting Started Checklist

- [ ] Set up GitHub repository with TypeScript/Next.js boilerplate
- [ ] Initialize PostgreSQL database (local + hosted)
- [ ] Create Sleeper developer account and test API access
- [ ] Design database schema and create migrations
- [ ] Implement authentication flow
- [ ] Build league connection interface
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Create project board with Phase 1 tasks
- [ ] Write initial tests for critical paths
- [ ] Set up error monitoring (Sentry)

---

**End of PRD**
