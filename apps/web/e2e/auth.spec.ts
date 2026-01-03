import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication user journeys
 *
 * Tests the complete user experience from the browser perspective
 */

test.describe('User Authentication', () => {
  test.describe('Registration Flow', () => {
    test('should allow new user to register', async ({ page }) => {
      // Navigate to homepage
      await page.goto('/');

      // Click "Get Started" button
      await page.click('text=Get Started');

      // Verify we're on the registration page
      await expect(page).toHaveURL('/register');

      // Wait for page to be fully hydrated
      await page.waitForLoadState('networkidle');

      // Fill in registration form
      const timestamp = Date.now();
      await page.fill('input[name="email"]', `testuser${timestamp}@example.com`);
      await page.fill('input[name="password"]', 'SecurePassword123!');
      await page.fill('input[name="name"]', 'Test User');

      // Submit form
      await page.click('button[type="submit"]');

      // Verify redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

      // Verify user is logged in (check for page heading)
      await expect(page.getByRole('heading', { name: 'My Leagues' })).toBeVisible();
    });

    test('should show validation errors for invalid email', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'ValidPassword123!');
      await page.click('button[type="submit"]');

      // Expect validation error
      await expect(page.getByText('Invalid email address')).toBeVisible();
    });

    test('should show validation errors for weak password', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123'); // Too short
      await page.click('button[type="submit"]');

      // Expect validation error about password length
      await expect(page.getByText(/password.*8.*characters/i)).toBeVisible();
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      const email = `duplicate${Date.now()}@example.com`;

      // First registration
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', 'SecurePassword123!');
      await page.fill('input[name="name"]', 'First User');
      await page.click('button[type="submit"]');

      // Wait for redirect
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

      // Logout
      await page.click('button:has-text("Logout")');
      await page.waitForURL('/login');

      // Try to register with same email
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', 'DifferentPassword123!');
      await page.fill('input[name="name"]', 'Second User');
      await page.click('button[type="submit"]');

      // Expect error message
      await expect(page.locator('text=/already exists/i')).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('should allow existing user to login', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Use the test user created in global setup
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');

      // Verify redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

      // Verify user is logged in
      await expect(page.getByRole('heading', { name: 'My Leagues' })).toBeVisible();
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Expect error message
      await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route', async ({ page }) => {
      // Try to access dashboard without being logged in
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL('/login');
    });
  });
});
