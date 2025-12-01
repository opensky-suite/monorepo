/**
 * E2E Tests: Authentication Flows
 * Critical Path: User Registration, Login, Logout, Password Reset
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'e2e-test-' + Date.now() + '@opensky.local',
  password: 'TestPassword123!',
  firstName: 'E2E',
  lastName: 'Tester',
};

test.describe('Authentication - Critical Paths', () => {
  test('user registration flow', async ({ page }) => {
    // Navigate to registration
    await page.goto('/register');
    await expect(page).toHaveTitle(/Register|Sign Up/i);

    // Fill registration form
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.fill('input[name="confirmPassword"]', TEST_USER.password);
    await page.fill('input[name="firstName"]', TEST_USER.firstName);
    await page.fill('input[name="lastName"]', TEST_USER.lastName);

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirect to dashboard or email verification
    await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 5000 });

    // Should show success message
    await expect(page.locator('text=/registered|created|success/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('login flow', async ({ page }) => {
    // Use existing test user from seed data
    const email = 'alice@opensky.local';
    const password = 'password123';

    await page.goto('/login');
    await expect(page).toHaveTitle(/Login|Sign In/i);

    // Fill login form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });

    // Verify logged in
    await expect(page.locator('text=/welcome|dashboard/i')).toBeVisible();
  });

  test('logout flow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'alice@opensky.local');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 5000 });

    // Logout
    await page.click('[aria-label="User menu"]');
    await page.click('text=/logout|sign out/i');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });

    // Verify logged out
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('password reset flow', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveTitle(/Reset|Forgot Password/i);

    // Request password reset
    await page.fill('input[name="email"]', 'alice@opensky.local');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=/email sent|check your email/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@opensky.local');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=/invalid|incorrect|error/i')).toBeVisible({
      timeout: 5000,
    });

    // Should NOT redirect
    await expect(page).toHaveURL(/\/login/);
  });
});
