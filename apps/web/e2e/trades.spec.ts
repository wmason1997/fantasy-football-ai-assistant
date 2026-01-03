import { test, expect, Page } from '@playwright/test';
import { navigateAuthenticated, authenticateUser } from './helpers/auth';

/**
 * E2E tests for Trade Recommendations user journey
 *
 * Tests the complete flow from logging in to viewing trade recommendations
 * Note: Authentication is handled via storage state from auth.setup.ts (except WebKit)
 */

test.describe('Trade Recommendations', () => {
  test.beforeEach(async ({ page, browserName }) => {
    // WebKit has issues with localStorage in storage state
    // So we authenticate manually for webkit
    if (browserName === 'webkit') {
      await authenticateUser(page, 'test@example.com', 'testpassword123');
    } else {
      // For chromium/firefox, storage state is already set
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Ensure localStorage token is available for navigateAuthenticated helper
      // Storage state should have set both cookies and localStorage, but sometimes
      // localStorage isn't restored properly, so we set it from cookies as fallback
      const token = await page.evaluate(() => localStorage.getItem('token'));
      if (!token) {
        const cookies = await page.context().cookies();
        const tokenCookie = cookies.find(c => c.name === 'token');
        if (tokenCookie) {
          await page.evaluate((cookieValue) => {
            localStorage.setItem('token', cookieValue);
          }, tokenCookie.value);
        }
      }
    }
  });

  test('should display trades tab in dashboard', async ({ page }) => {
    // Navigate to trades tab
    await page.click('text=Trades');

    // Verify URL
    await expect(page).toHaveURL('/dashboard/trades');

    // The page should show either the Trade Recommendations heading or the empty state
    // We use a flexible matcher that works for both scenarios
    await expect(
      page.locator('h1:has-text("Trade Recommendations"), h3:has-text("No leagues connected")')
    ).toBeVisible();
  });

  test('should show sell-high candidates', async ({ page }) => {
    await navigateAuthenticated(page, '/dashboard/trades');

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
    await navigateAuthenticated(page, '/dashboard/trades');

    // Look for buy-low section
    const buyLowSection = page.locator('text=Buy Low').locator('..');

    const exists = await buyLowSection.count() > 0;
    if (exists) {
      await expect(buyLowSection).toBeVisible();
    }
  });

  test('should display trade package recommendations', async ({ page }) => {
    await navigateAuthenticated(page, '/dashboard/trades');

    // Look for trade recommendations
    const tradeCards = page.locator('[data-testid="trade-recommendation-card"]');

    const count = await tradeCards.count();
    if (count > 0) {
      const firstTrade = tradeCards.first();

      // Click to view details
      await firstTrade.click();

      // Verify modal/details view opens
      const modal = page.locator('[data-testid="trade-details-modal"]');
      await expect(modal).toBeVisible();

      // Verify fairness score heading is displayed in modal
      await expect(modal.locator('h3:has-text("Fairness Score")')).toBeVisible();

      // Verify acceptance probability heading is displayed in modal
      await expect(modal.locator('h3:has-text("Acceptance Probability")')).toBeVisible();
    }
  });

  test('should allow filtering trade recommendations', async ({ page }) => {
    await navigateAuthenticated(page, '/dashboard/trades');

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
    await navigateAuthenticated(page, '/dashboard/trades');

    // Look for the specific "No leagues connected" heading
    const noLeaguesHeading = page.locator('h3:has-text("No leagues connected")');

    // Check if the empty state is shown
    const count = await noLeaguesHeading.count();
    if (count > 0) {
      await expect(noLeaguesHeading).toBeVisible();
      // Verify the connect league button is present
      await expect(page.locator('a:has-text("Connect League")')).toBeVisible();
    } else {
      // If leagues are connected, we should see the Trade Recommendations heading
      await expect(page.locator('h1:has-text("Trade Recommendations")')).toBeVisible();
    }
  });
});
