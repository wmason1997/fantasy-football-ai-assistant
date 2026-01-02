# Testing Strategy

## Overview
This document outlines the comprehensive testing strategy for the Fantasy Football AI Assistant. We use a three-tier approach: Unit Tests, Integration Tests, and End-to-End Tests.

**Test Coverage Goal:** >70% for MVP (as specified in CLAUDE.md)

## Testing Stack

- **Unit & Integration Tests:** Vitest
- **API Testing:** Supertest
- **E2E Testing:** Playwright
- **Test Database:** PostgreSQL (separate from dev)
- **Mocking:** Vitest built-in mocking + MSW (Mock Service Worker) for external APIs

## 1. Unit Tests (Vitest)

**Purpose:** Test business logic in isolation

### Files to Test:
- `apps/api/src/services/tradeAnalyzer.ts`
- `apps/api/src/services/waiverOptimizer.ts`
- `apps/api/src/services/opponentLearning.ts`
- `apps/api/src/services/projections.ts`
- `apps/api/src/services/injuryMonitor.ts`
- `apps/api/src/services/playerSync.ts`

### Key Test Scenarios:

#### Trade Analyzer
- Calculate sell-high candidates (performance ratio > 1.15)
- Identify buy-low targets (value discount > 0.2)
- Generate trade packages (1-for-1, 2-for-1, 2-for-2)
- Calculate fairness score (must be >0.6)
- Calculate acceptance probability (must be >0.25)

#### Waiver Optimizer
- FAAB bid calculation formula
- Position need multiplier
- Urgency adjustment for trending adds
- Max bid constraint (40% of remaining budget)
- Waiver priority ranking

#### Opponent Learning
- Bayesian position preference updates (0.8 * old + 0.2 * new)
- Trade acceptance rate calculation
- Risk tolerance updates

#### Projections
- Basic projection algorithm
- Top projected players filtering
- Week-over-week projection changes

### Run Unit Tests:
```bash
cd apps/api
pnpm test
```

## 2. Integration Tests (Vitest + Supertest)

**Purpose:** Test API endpoints with real database interactions

### Setup:
- Use test database (separate from development)
- Reset database before each test suite
- Mock external API calls (Sleeper API)

### Endpoints to Test:

#### Auth (`/auth`)
- POST `/auth/register` - Create new user
- POST `/auth/login` - Login and receive JWT
- Error cases: duplicate email, invalid credentials, weak password

#### Leagues (`/leagues`)
- POST `/leagues/connect` - Connect Sleeper league (mocked)
- GET `/leagues` - Get all connected leagues
- GET `/leagues/:id` - Get specific league
- POST `/leagues/:id/sync` - Trigger roster sync

#### Players (`/players`)
- GET `/players/search` - Search players
- GET `/players/:playerId` - Get player details
- GET `/players/:playerId/projections` - Get player projections
- POST `/players/sync` - Trigger player sync (mocked Sleeper API)

#### Trades (`/trades`)
- GET `/trades/recommendations/:leagueId` - Get trade recommendations
- GET `/trades/:leagueId/history` - Get trade history

#### Waivers (`/waivers`)
- GET `/waivers/recommendations/:leagueId` - Get waiver recommendations
- GET `/waivers/:leagueId/history` - Get waiver history

#### Injuries (`/injuries`)
- POST `/injuries/start-monitoring` - Start injury monitor
- POST `/injuries/stop-monitoring` - Stop injury monitor
- GET `/injuries/alerts/:leagueId` - Get injury alerts

### Run Integration Tests:
```bash
cd apps/api
pnpm test:integration
```

## 3. E2E Tests (Playwright)

**Purpose:** Test complete user journeys from browser perspective

### Setup:
- Test against local development environment
- Use test database
- Mock external APIs (Sleeper)

### User Journeys to Test:

#### Journey 1: New User Onboarding
1. Navigate to homepage
2. Click "Get Started"
3. Register new account
4. Verify redirect to dashboard

#### Journey 2: League Connection
1. Login as existing user
2. Navigate to "Connect League"
3. Enter Sleeper league ID
4. Verify league appears in dashboard
5. Verify roster data loads

#### Journey 3: Trade Recommendations
1. Login with connected league
2. Navigate to "Trades" tab
3. Verify sell-high players displayed
4. Click on trade recommendation
5. Verify trade details modal opens
6. Verify fairness score and acceptance probability shown

#### Journey 4: Waiver Recommendations
1. Login with connected league
2. Navigate to "Waivers" tab
3. Verify waiver targets displayed
4. Verify FAAB bid amounts shown
5. Verify positional need indicators

#### Journey 5: Injury Monitoring
1. Login with connected league
2. Navigate to "Injuries" tab
3. Start injury monitoring
4. Verify monitoring status indicator
5. Verify bench substitution recommendations appear (when injuries detected)

### Run E2E Tests:
```bash
cd apps/web
pnpm test:e2e
```

Or with UI:
```bash
pnpm test:e2e:ui
```

## 4. Test Data Management

### Fixtures
- Sample players with various positions, teams, projections
- Sample leagues with different settings (PPR, Standard, etc.)
- Sample rosters with various team compositions
- Sample transactions (trades, waivers, adds/drops)
- Sample injury data

### Database Seeding
```bash
pnpm db:seed:test
```

## 5. Continuous Integration

### GitHub Actions Workflow
- Run on every PR and push to main
- Steps:
  1. Start PostgreSQL and Redis (Docker)
  2. Run database migrations
  3. Run unit tests
  4. Run integration tests
  5. Build frontend and backend
  6. Run E2E tests
  7. Upload test coverage report

## 6. Test Coverage Requirements

**Minimum Coverage (MVP):**
- **Overall:** 70%
- **Critical Paths:** 90%
  - Trade algorithm
  - Waiver algorithm
  - Authentication
  - League sync
  - Injury detection

**Coverage Reports:**
```bash
pnpm test:coverage
```

## 7. Performance Testing (Future Phase)

### Load Testing (Artillery or k6)
- Concurrent users during game windows
- API endpoint response times
- Database query performance
- Redis cache hit rates

## 8. Mocking External APIs

### Sleeper API Mocks
- Use MSW (Mock Service Worker) to intercept HTTP requests
- Mock responses for:
  - `/players/nfl` - Player database
  - `/league/{id}` - League settings
  - `/league/{id}/rosters` - Roster data
  - `/league/{id}/transactions/{week}` - Transaction history

### Example Mock:
```typescript
import { rest } from 'msw';

const sleeperMocks = [
  rest.get('https://api.sleeper.app/v1/players/nfl', (req, res, ctx) => {
    return res(ctx.json(mockPlayerData));
  }),
];
```

## 9. Running All Tests

```bash
# Run everything
pnpm test:all

# Watch mode (development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E only
pnpm test:e2e

# Integration only
pnpm test:integration
```

## 10. Test File Naming Conventions

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` (Playwright convention)

## 11. Critical Paths to Test

As specified in CLAUDE.md, these are the most critical test scenarios:

1. **League connection and sync** - Ensure data flows correctly from Sleeper API
2. **Trade recommendation generation** - Core algorithm produces valid recommendations
3. **Waiver bid calculation** - FAAB/priority calculations are accurate
4. **Injury alert delivery** - Monitoring and notifications work reliably
5. **Opponent profile updates** - Learning system updates correctly over time

## Next Steps

1. Set up Vitest config for API
2. Install and configure Playwright
3. Create test database and seed scripts
4. Write first unit tests for trade analyzer
5. Set up MSW for mocking Sleeper API
6. Implement first integration test suite
7. Create first E2E test for user registration
8. Configure CI/CD pipeline
