/**
 * E2E Tests: Navigation
 * Critical Path: Basic navigation between pages
 */

import { test, expect } from '@playwright/test';

// Helper: Login before tests
async function loginAsAlice(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alice@opensky.local');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 5000 });
}

test.describe('Navigation - Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlice(page);
  });

  test('navigate to SkyMail', async ({ page }) => {
    await page.click('a[href="/mail"], nav >> text=Mail');
    await page.waitForURL(/\/mail/, { timeout: 5000 });
    await expect(page.locator('text=/inbox|email/i')).toBeVisible();
  });

  test('navigate to SkyDrive', async ({ page }) => {
    await page.click('a[href="/drive"], nav >> text=Drive');
    await page.waitForURL(/\/drive/, { timeout: 5000 });
    await expect(page.locator('text=/files|my drive/i')).toBeVisible();
  });

  test('navigate to SkyDocs', async ({ page }) => {
    await page.click('a[href="/docs"], nav >> text=Docs');
    await page.waitForURL(/\/docs/, { timeout: 5000 });
    await expect(page.locator('text=/documents|docs/i')).toBeVisible();
  });

  test('navigate to Settings', async ({ page }) => {
    await page.click('a[href="/settings"], nav >> text=Settings');
    await page.waitForURL(/\/settings/, { timeout: 5000 });
    await expect(page.locator('text=/settings|profile/i')).toBeVisible();
  });

  test('back button works', async ({ page }) => {
    // Go to mail
    await page.click('a[href="/mail"]');
    await page.waitForURL(/\/mail/, { timeout: 5000 });

    // Go back
    await page.goBack();
    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page.locator('text=/dashboard/i')).toBeVisible();
  });

  test('breadcrumbs work', async ({ page }) => {
    // Navigate deep
    await page.click('a[href="/drive"]');
    await page.waitForURL(/\/drive/, { timeout: 5000 });

    // Click breadcrumb home
    await page.click('nav >> text=Home, a[href="/"]');
    await page.waitForURL('/', { timeout: 5000 });
  });
});
