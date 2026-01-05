import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global setup */
  globalSetup: './e2e/setup/global-setup.ts',
  /* Increase timeouts for dev mode (Next.js pages compile on first request) */
  timeout: 120 * 1000, // 2 minutes per test
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* Increase navigation timeout for dev server compilation */
    navigationTimeout: 120 * 1000, // 2 minutes
    actionTimeout: 10 * 1000, // 10 seconds for actions
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project - runs first to authenticate
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Auth tests should not use authenticated storage state
    {
      name: 'auth-chromium',
      testMatch: /.*auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-firefox',
      testMatch: /.*auth\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'auth-webkit',
      testMatch: /.*auth\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    // Authenticated tests for all other specs
    {
      name: 'chromium',
      testIgnore: /.*auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Use the authenticated state for all tests
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      testIgnore: /.*auth\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      testIgnore: /.*auth\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        // WebKit has issues with localStorage in storage state, so we skip it
        // and rely on beforeEach authentication in tests
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm --filter @fantasy-football/api dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
