/**
 * E2E Tests: File Operations (SkyDrive)
 * Critical Path: File upload, download, delete
 */

import { test, expect } from '@playwright/test';
import path from 'path';

async function loginAsAlice(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alice@opensky.local');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 5000 });
}

test.describe('File Operations - Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlice(page);
    await page.goto('/drive');
  });

  test('upload file', async ({ page }) => {
    // Create test file
    const testFile = path.join(__dirname, '../fixtures/test-file.txt');

    // Click upload button
    await page.click('button:has-text("Upload"), input[type="file"]');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);

    // Verify file appears in list
    await expect(page.locator('text=test-file.txt')).toBeVisible({ timeout: 10000 });
  });

  test('create folder', async ({ page }) => {
    // Click new folder
    await page.click('button:has-text("New Folder")');

    // Enter folder name
    await page.fill('input[placeholder*="folder name"]', 'Test Folder ' + Date.now());
    await page.click('button:has-text("Create")');

    // Verify folder appears
    await expect(page.locator('.folder-list >> text=/Test Folder/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('delete file', async ({ page }) => {
    // Find first file
    const file = page.locator('.file-list >> .file-item').first();
    await file.hover();

    // Click delete
    await file.locator('button[aria-label="Delete"]').click();

    // Confirm
    await page.click('button:has-text("Delete"), button:has-text("Confirm")');

    // Verify deleted (should show toast)
    await expect(page.locator('text=/deleted|removed/i')).toBeVisible({ timeout: 5000 });
  });

  test('rename file', async ({ page }) => {
    // Find first file
    const file = page.locator('.file-list >> .file-item').first();
    await file.hover();

    // Click rename
    await file.locator('button[aria-label="Rename"]').click();

    // Enter new name
    const newName = 'Renamed-' + Date.now() + '.txt';
    await page.fill('input[placeholder*="name"]', newName);
    await page.click('button:has-text("Rename"), button:has-text("Save")');

    // Verify renamed
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 5000 });
  });

  test('share file', async ({ page }) => {
    // Find first file
    const file = page.locator('.file-list >> .file-item').first();
    await file.hover();

    // Click share
    await file.locator('button[aria-label="Share"]').click();

    // Enter email
    await page.fill('input[placeholder*="email"]', 'bob@opensky.local');
    await page.click('button:has-text("Share")');

    // Verify shared
    await expect(page.locator('text=/shared|invited/i')).toBeVisible({ timeout: 5000 });
  });
});
