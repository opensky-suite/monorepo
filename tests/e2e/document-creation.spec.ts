/**
 * E2E Tests: Document Creation (SkyDocs)
 * Critical Path: Create, edit, save document
 */

import { test, expect } from '@playwright/test';

async function loginAsAlice(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alice@opensky.local');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 5000 });
}

test.describe('Document Creation - Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlice(page);
    await page.goto('/docs');
  });

  test('create new document', async ({ page }) => {
    // Click new document
    await page.click('button:has-text("New Document")');

    // Should open editor
    await page.waitForURL(/\/docs\/new|\/docs\/[a-z0-9-]+/, { timeout: 5000 });

    // Verify editor loaded
    await expect(page.locator('.document-editor, [contenteditable="true"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('edit document content', async ({ page }) => {
    // Create new document
    await page.click('button:has-text("New Document")');
    await page.waitForURL(/\/docs\//, { timeout: 5000 });

    // Edit title
    const title = 'E2E Test Document ' + Date.now();
    await page.fill('input[placeholder*="title"], .document-title', title);

    // Edit content
    const editor = page.locator('.document-editor, [contenteditable="true"]');
    await editor.click();
    await editor.fill('This is a test document created by E2E tests.');

    // Verify content
    await expect(editor).toContainText('test document');
  });

  test('save document', async ({ page }) => {
    // Create and edit document
    await page.click('button:has-text("New Document")');
    await page.waitForURL(/\/docs\//, { timeout: 5000 });

    const title = 'Save Test ' + Date.now();
    await page.fill('input[placeholder*="title"], .document-title', title);

    const editor = page.locator('.document-editor, [contenteditable="true"]');
    await editor.click();
    await editor.fill('Content to save');

    // Save (usually auto-saves, but click if button exists)
    const saveButton = page.locator('button:has-text("Save")');
    if (await saveButton.isVisible({ timeout: 1000 })) {
      await saveButton.click();
    }

    // Wait for save indicator
    await expect(page.locator('text=/saved|synced/i')).toBeVisible({ timeout: 10000 });
  });

  test('format text', async ({ page }) => {
    // Create document
    await page.click('button:has-text("New Document")');
    await page.waitForURL(/\/docs\//, { timeout: 5000 });

    const editor = page.locator('.document-editor, [contenteditable="true"]');
    await editor.click();
    await editor.fill('Bold text here');

    // Select text
    await editor.selectText();

    // Click bold button
    await page.click('button[aria-label="Bold"], button:has-text("B")');

    // Verify bold applied (check for <strong> or class)
    await expect(page.locator('.document-editor strong, .document-editor .bold')).toBeVisible({
      timeout: 5000,
    });
  });

  test('delete document', async ({ page }) => {
    // Find first document
    const doc = page.locator('.document-list >> .document-item').first();

    if (await doc.isVisible({ timeout: 1000 })) {
      await doc.hover();

      // Click delete
      await doc.locator('button[aria-label="Delete"]').click();

      // Confirm
      await page.click('button:has-text("Delete"), button:has-text("Confirm")');

      // Verify deleted
      await expect(page.locator('text=/deleted|removed/i')).toBeVisible({ timeout: 5000 });
    }
  });
});
