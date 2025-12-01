/**
 * Visual Regression Screenshot Tests
 * Issue #5: Comprehensive screenshot testing framework
 * 
 * These tests capture screenshots and compare against baseline images.
 * Run with: npm run test:screenshots
 */

import { test, expect } from '@playwright/test';

// Helper to take and compare screenshot
async function screenshotPage(
  page: any,
  name: string,
  options?: { fullPage?: boolean; mask?: string[] }
) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: options?.fullPage ?? true,
    mask: options?.mask?.map(selector => page.locator(selector)) ?? [],
    maxDiffPixels: 100, // Allow slight rendering differences
  });
}

test.describe('Auth Pages', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    await screenshotPage(page, 'auth-login');
  });

  test('registration page', async ({ page }) => {
    await page.goto('/register');
    await page.waitForSelector('form', { timeout: 10000 });
    await screenshotPage(page, 'auth-register');
  });

  test('password reset page', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('form', { timeout: 10000 });
    await screenshotPage(page, 'auth-forgot-password');
  });
});

test.describe('Dashboard', () => {
  test('main dashboard', async ({ page }) => {
    // TODO: Add authentication when implemented
    await page.goto('/dashboard');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    await screenshotPage(page, 'dashboard-main');
  });
});

test.describe('SkyMail', () => {
  test('inbox view', async ({ page }) => {
    await page.goto('/mail/inbox');
    await page.waitForSelector('.email-list', { timeout: 10000 });
    await screenshotPage(page, 'mail-inbox', {
      mask: ['.timestamp', '.unread-count'], // Mask dynamic content
    });
  });

  test('compose email', async ({ page }) => {
    await page.goto('/mail/compose');
    await page.waitForSelector('.compose-editor', { timeout: 10000 });
    await screenshotPage(page, 'mail-compose');
  });

  test('email thread', async ({ page }) => {
    await page.goto('/mail/thread/sample');
    await page.waitForSelector('.thread-view', { timeout: 10000 });
    await screenshotPage(page, 'mail-thread', {
      mask: ['.timestamp', '.avatar'], // Mask dynamic content
    });
  });
});

test.describe('SkyDocs', () => {
  test('document list', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForSelector('.document-list', { timeout: 10000 });
    await screenshotPage(page, 'docs-list');
  });

  test('document editor', async ({ page }) => {
    await page.goto('/docs/new');
    await page.waitForSelector('.document-editor', { timeout: 10000 });
    await screenshotPage(page, 'docs-editor');
  });
});

test.describe('SkyDrive', () => {
  test('file list', async ({ page }) => {
    await page.goto('/drive');
    await page.waitForSelector('.file-list', { timeout: 10000 });
    await screenshotPage(page, 'drive-home');
  });

  test('shared files', async ({ page }) => {
    await page.goto('/drive/shared');
    await page.waitForSelector('.shared-files', { timeout: 10000 });
    await screenshotPage(page, 'drive-shared');
  });
});

test.describe('Settings', () => {
  test('profile settings', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForSelector('.settings-form', { timeout: 10000 });
    await screenshotPage(page, 'settings-profile');
  });

  test('security settings', async ({ page }) => {
    await page.goto('/settings/security');
    await page.waitForSelector('.security-settings', { timeout: 10000 });
    await screenshotPage(page, 'settings-security');
  });
});

// Mobile screenshots
test.describe('Mobile Views', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('mobile inbox', async ({ page }) => {
    await page.goto('/mail/inbox');
    await page.waitForSelector('.email-list', { timeout: 10000 });
    await screenshotPage(page, 'mobile-inbox');
  });

  test('mobile dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    await screenshotPage(page, 'mobile-dashboard');
  });
});
