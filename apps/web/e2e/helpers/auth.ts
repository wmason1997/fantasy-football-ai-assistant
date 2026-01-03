import { Page, expect } from '@playwright/test';

/**
 * Helper to authenticate a user and ensure session state is properly established
 */
export async function authenticateUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

  // Ensure authentication state is established by checking for the token cookie
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find(c => c.name === 'token');
  expect(tokenCookie).toBeDefined();

  // Wait for any hydration/auth checks to complete
  await page.waitForLoadState('networkidle');

  // For WebKit, localStorage might not be set immediately, so we manually set it from the cookie
  // This ensures navigateAuthenticated works properly
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token && tokenCookie) {
    await page.evaluate((cookieValue) => {
      localStorage.setItem('token', cookieValue);
    }, tokenCookie.value);
  }
}

/**
 * Navigate to a protected route while ensuring auth state is maintained
 */
export async function navigateAuthenticated(page: Page, path: string) {
  // Verify we have a token (check localStorage first, then cookies as fallback)
  let token = await page.evaluate(() => localStorage.getItem('token'));

  if (!token) {
    // Try to get token from cookies and set localStorage
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find(c => c.name === 'token');
    if (tokenCookie) {
      await page.evaluate((cookieValue) => {
        localStorage.setItem('token', cookieValue);
      }, tokenCookie.value);
      token = tokenCookie.value;
    }
  }

  if (!token) {
    throw new Error('User is not authenticated. Call authenticateUser first.');
  }

  // Navigate to the path
  await page.goto(path);

  // Ensure we're not redirected to login (which would indicate lost session)
  await page.waitForLoadState('networkidle');
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    throw new Error('Session was lost during navigation. User was redirected to login.');
  }
}
