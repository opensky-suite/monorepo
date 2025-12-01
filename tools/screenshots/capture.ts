#!/usr/bin/env tsx
/**
 * Screenshot Capture Tool
 * Captures screenshots of all pages for visual regression testing
 * 
 * Usage:
 *   npm run screenshots:capture [--update-baseline]
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const BASELINE_DIR = path.join(process.cwd(), 'tests/screenshots/baseline');
const CURRENT_DIR = path.join(process.cwd(), 'tests/screenshots/current');
const DIFF_DIR = path.join(process.cwd(), 'tests/screenshots/diff');

// Ensure directories exist
[BASELINE_DIR, CURRENT_DIR, DIFF_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface ScreenshotPage {
  name: string;
  url: string;
  waitFor?: string; // Selector to wait for before screenshot
  actions?: (page: Page) => Promise<void>; // Actions before screenshot
}

// Define all pages to screenshot
const pages: ScreenshotPage[] = [
  // Auth pages
  { name: 'login', url: '/login', waitFor: 'button[type="submit"]' },
  { name: 'register', url: '/register', waitFor: 'form' },
  { name: 'forgot-password', url: '/forgot-password', waitFor: 'form' },
  
  // Dashboard
  { name: 'dashboard', url: '/dashboard', waitFor: '.dashboard-container' },
  
  // SkyMail
  { name: 'mail-inbox', url: '/mail/inbox', waitFor: '.email-list' },
  { name: 'mail-compose', url: '/mail/compose', waitFor: '.compose-editor' },
  { name: 'mail-thread', url: '/mail/thread/1', waitFor: '.thread-view' },
  
  // SkyDocs
  { name: 'docs-list', url: '/docs', waitFor: '.document-list' },
  { name: 'docs-editor', url: '/docs/new', waitFor: '.document-editor' },
  
  // SkyDrive
  { name: 'drive-home', url: '/drive', waitFor: '.file-list' },
  { name: 'drive-shared', url: '/drive/shared', waitFor: '.shared-files' },
  
  // Settings
  { name: 'settings-profile', url: '/settings/profile', waitFor: '.settings-form' },
  { name: 'settings-security', url: '/settings/security', waitFor: '.security-settings' },
];

async function captureScreenshots(updateBaseline = false) {
  console.log('🚀 Starting screenshot capture...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  
  const results = {
    captured: 0,
    failed: 0,
    changed: 0,
    pages: [] as string[],
  };
  
  for (const pageConfig of pages) {
    try {
      console.log(`📸 Capturing: ${pageConfig.name}`);
      
      // Navigate to page
      await page.goto(`http://localhost:3000${pageConfig.url}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      // Wait for specific element if specified
      if (pageConfig.waitFor) {
        await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 });
      }
      
      // Execute custom actions if specified
      if (pageConfig.actions) {
        await pageConfig.actions(page);
      }
      
      // Take screenshot
      const screenshotPath = path.join(
        updateBaseline ? BASELINE_DIR : CURRENT_DIR,
        `${pageConfig.name}.png`
      );
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
      
      results.captured++;
      results.pages.push(pageConfig.name);
      
      // Compare with baseline if not updating
      if (!updateBaseline && fs.existsSync(path.join(BASELINE_DIR, `${pageConfig.name}.png`))) {
        const baseline = fs.readFileSync(path.join(BASELINE_DIR, `${pageConfig.name}.png`));
        const current = fs.readFileSync(screenshotPath);
        
        const baselineHash = createHash('sha256').update(baseline).digest('hex');
        const currentHash = createHash('sha256').update(current).digest('hex');
        
        if (baselineHash !== currentHash) {
          console.log(`  ⚠️  Changed: ${pageConfig.name}`);
          results.changed++;
        } else {
          console.log(`  ✓ Unchanged: ${pageConfig.name}`);
        }
      }
      
    } catch (error) {
      console.error(`  ✗ Failed: ${pageConfig.name}`, error);
      results.failed++;
    }
  }
  
  await browser.close();
  
  console.log('\n📊 Summary:');
  console.log(`  Captured: ${results.captured}/${pages.length}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Changed: ${results.changed}`);
  
  // Write results
  fs.writeFileSync(
    path.join(DIFF_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  
  return results;
}

// Run if called directly
if (require.main === module) {
  const updateBaseline = process.argv.includes('--update-baseline');
  
  if (updateBaseline) {
    console.log('🔄 Updating baseline screenshots...\n');
  }
  
  captureScreenshots(updateBaseline)
    .then(results => {
      if (results.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { captureScreenshots };
