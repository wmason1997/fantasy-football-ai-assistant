# Testing Quick Start Guide

## Setup Complete ✅

Your testing infrastructure is now fully configured with:
- **Vitest** for unit and integration tests
- **Supertest** for API endpoint testing
- **Playwright** for end-to-end browser testing
- **MSW** for mocking external APIs
- **Faker** for generating test data

## Running Tests

### Unit Tests (Fast - seconds)
```bash
# Run all unit tests
pnpm test:unit

# Watch mode (re-run on file changes)
pnpm --filter @fantasy-football/api test:watch

# With coverage report
pnpm test:coverage
```

### Integration Tests (Slower - uses real database)
```bash
# Run all integration tests
pnpm test:integration
```

### E2E Tests (Slowest - full browser automation)
```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with UI (visual test runner)
pnpm --filter @fantasy-football/web test:e2e:ui

# Debug mode (step through tests)
pnpm --filter @fantasy-football/web test:e2e:debug

# Watch tests run in browser
pnpm --filter @fantasy-football/web test:e2e:headed
```

### Run Everything
```bash
# Run all test types sequentially
pnpm test:all
```

## Test File Structure

```
apps/api/
├── src/
│   ├── services/
│   │   └── __tests__/
│   │       └── tradeAnalyzer.test.ts          # Unit tests
│   ├── routes/
│   │   └── __tests__/
│   │       └── auth.integration.test.ts       # Integration tests
│   └── __tests__/
│       ├── setup.ts                           # Unit test setup
│       └── setup.integration.ts               # Integration test setup
└── vitest.config.ts                           # Vitest configuration

apps/web/
├── e2e/
│   ├── auth.spec.ts                           # E2E auth tests
│   └── trades.spec.ts                         # E2E trade flow tests
└── playwright.config.ts                       # Playwright configuration
```

## Writing Your First Test

### Unit Test Example
```typescript
// apps/api/src/services/__tests__/myService.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('MyService', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Integration Test Example
```typescript
// apps/api/src/routes/__tests__/myRoute.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../server-test-helper';

describe('My Route', () => {
  let server;

  beforeAll(async () => {
    server = await build();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/my-endpoint',
    });

    expect(response.statusCode).toBe(200);
  });
});
```

### E2E Test Example
```typescript
// apps/web/e2e/myFlow.spec.ts
import { test, expect } from '@playwright/test';

test('should complete user flow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Get Started');
  await expect(page).toHaveURL('/register');
});
```

## Next Steps

1. **Install Playwright Browsers** (first time only):
   ```bash
   cd apps/web
   pnpm exec playwright install
   ```

2. **Implement the TODOs** in example test files:
   - `apps/api/src/services/__tests__/tradeAnalyzer.test.ts`
   - `apps/api/src/routes/__tests__/auth.integration.test.ts`

3. **Write tests for**:
   - Trade analyzer algorithms (unit)
   - Waiver optimizer calculations (unit)
   - Opponent learning updates (unit)
   - Player sync service (integration)
   - Injury monitoring service (integration)
   - Complete user journeys (E2E)

4. **Set up test database**:
   ```bash
   # Create test database
   psql -U dev_user -h localhost -c "CREATE DATABASE fantasy_football_test;"

   # Run migrations on test database
   DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/fantasy_football_test" pnpm db:migrate
   ```

5. **Configure CI/CD** (GitHub Actions):
   - Add `.github/workflows/test.yml`
   - Run tests on every PR
   - Upload coverage reports

## Test Coverage Goals

As specified in CLAUDE.md:
- **Overall:** 70% minimum
- **Critical paths:** 90%
  - Trade algorithm
  - Waiver algorithm
  - Authentication
  - League sync
  - Injury detection

## Useful Commands

```bash
# Check coverage
pnpm test:coverage

# Run specific test file
pnpm --filter @fantasy-football/api test tradeAnalyzer

# Run tests matching pattern
pnpm --filter @fantasy-football/api test --grep "Sell-High"

# Generate Playwright test code (record interactions)
pnpm --filter @fantasy-football/web exec playwright codegen http://localhost:3000

# View Playwright test report
pnpm --filter @fantasy-football/web exec playwright show-report
```

## Mocking External APIs

Example using MSW to mock Sleeper API:

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.sleeper.app/v1/players/nfl', () => {
    return HttpResponse.json({ /* mock data */ });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [MSW Documentation](https://mswjs.io/)

---

**Happy Testing!** 🧪
