# E2E Testing Documentation

## Authentication Setup

Tests use storage state to maintain authentication across test runs for better performance.

### How It Works

1. **Auth Setup** (`e2e/setup/auth.setup.ts`): Runs once before all tests to log in and save the authenticated state
2. **Storage State**: Cookies and localStorage are saved to `.auth/user.json`
3. **Test Execution**: Tests automatically use the saved authentication state

### Browser Support

- ✅ **Chromium**: Full support for storage state
- ✅ **Firefox**: Full support for storage state
- ⚠️ **WebKit**: Limited support - localStorage not properly restored from storage state
  - WebKit tests use manual authentication in `beforeEach` as a workaround
  - This is a known limitation with WebKit's storage state implementation

### Helper Functions

Authentication helpers are available in `e2e/helpers/auth.ts`:

- `authenticateUser(page, email, password)`: Logs in a user and ensures session state is established
- `navigateAuthenticated(page, path)`: Navigates to a protected route while ensuring auth state is maintained

### Test Data

The global setup (`e2e/setup/global-setup.ts`) creates:
- Test user: `test@example.com` / `testpassword123`
- Test league: "Test League" with mock data

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e trades.spec.ts

# Run only Chromium tests
pnpm test:e2e --project=chromium

# Run with UI
pnpm test:e2e --ui
```

## Known Issues

### WebKit Authentication
WebKit has issues with:
1. localStorage not being properly restored from storage state
2. Potential race conditions with cookie setting during login

**Workaround**: Tests use manual authentication in `beforeEach` for WebKit.

**Impact**: WebKit tests run slightly slower than Chromium/Firefox due to repeated logins.
