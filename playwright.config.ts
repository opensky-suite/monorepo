import { defineConfig, devices } from '@playwright/test';

/**
 * Comprehensive Screenshot Testing Configuration
 * Issue #5: Screenshot testing framework with visual regression
 */
export default defineConfig({
  testDir: './tests',
  
  // Screenshot directories
  snapshotDir: './tests/screenshots/baseline',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',
  
  // Parallel execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter with screenshot diff support
  reporter: [
    ['html', { outputFolder: 'tests/screenshots/reports', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'tests/screenshots/reports/results.json' }],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Screenshot settings for consistency
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Local development server (when ready)
  webServer: process.env.SKIP_SERVER ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
