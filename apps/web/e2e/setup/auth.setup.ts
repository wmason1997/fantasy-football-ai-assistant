import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

/**
 * Authentication setup that runs once before all tests
 * Saves the authenticated state to be reused by all tests
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in login credentials
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'testpassword123');

  // Submit login form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

  // Verify authentication is complete
  await page.waitForLoadState('networkidle');

  // Verify token is set in localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  // Verify token cookie is set
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find(c => c.name === 'token');
  expect(tokenCookie).toBeDefined();

  // Save the storage state (cookies, localStorage, etc.)
  await page.context().storageState({ path: authFile });
});
