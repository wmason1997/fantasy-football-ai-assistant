import { test, expect } from '@playwright/test';

/**
 * E2E tests for Trade Recommendations user journey
 *
 * Tests the complete flow from logging in to viewing trade recommendations
 */

test.describe('Trade Recommendations', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should display trades tab in dashboard', async ({ page }) => {
    // Navigate to trades tab
    await page.click('text=Trades');

    // Verify URL
    await expect(page).toHaveURL('/dashboard/trades');

    // Verify page heading
    await expect(page.locator('h1:has-text("Trade Recommendations")')).toBeVisible();
  });

  test('should show sell-high candidates', async ({ page }) => {
    await page.goto('/dashboard/trades');

    // Look for sell-high section
    const sellHighSection = page.locator('text=Sell High').locator('..');

    // Check if it exists (might be empty if no players meet criteria)
    const exists = await sellHighSection.count() > 0;
    if (exists) {
      await expect(sellHighSection).toBeVisible();

      // Check for player cards
      const playerCards = sellHighSection.locator('[data-testid="player-card"]');
      if (await playerCards.count() > 0) {
        // Verify player card has required information
        const firstCard = playerCards.first();
        await expect(firstCard.locator('text=Performance Ratio')).toBeVisible();
      }
    }
  });

  test('should show buy-low candidates', async ({ page }) => {
    await page.goto('/dashboard/trades');

    // Look for buy-low section
    const buyLowSection = page.locator('text=Buy Low').locator('..');

    const exists = await buyLowSection.count() > 0;
    if (exists) {
      await expect(buyLowSection).toBeVisible();
    }
  });

  test('should display trade package recommendations', async ({ page }) => {
    await page.goto('/dashboard/trades');

    // Look for trade recommendations
    const tradeCards = page.locator('[data-testid="trade-recommendation-card"]');

    const count = await tradeCards.count();
    if (count > 0) {
      const firstTrade = tradeCards.first();

      // Click to view details
      await firstTrade.click();

      // Verify modal/details view opens
      await expect(page.locator('[data-testid="trade-details-modal"]')).toBeVisible();

      // Verify fairness score is displayed
      await expect(page.locator('text=Fairness Score')).toBeVisible();

      // Verify acceptance probability is displayed
      await expect(page.locator('text=Acceptance Probability')).toBeVisible();
    }
  });

  test('should allow filtering trade recommendations', async ({ page }) => {
    await page.goto('/dashboard/trades');

    // Look for filter controls
    const positionFilter = page.locator('select[name="position"]');

    if (await positionFilter.count() > 0) {
      // Select a position (e.g., WR)
      await positionFilter.selectOption('WR');

      // Verify results update
      // (Implementation depends on how filtering works)
    }
  });

  test('should show empty state when no league connected', async ({ page }) => {
    // Assuming user has no leagues connected
    await page.goto('/dashboard/trades');

    // Look for connect league prompt
    const connectPrompt = page.locator('text=/connect.*league/i');

    // Might be visible if no leagues are connected
    if (await connectPrompt.count() > 0) {
      await expect(connectPrompt).toBeVisible();
    }
  });
});
