# E2E Testing Framework

## Overview

Fast, focused E2E testing covering **critical user paths only**. Target: <2 minutes execution time.

---

## Critical Paths Covered

### 1. Authentication (tests/e2e/auth.spec.ts)
- ✅ User registration
- ✅ Login/Logout
- ✅ Password reset
- ✅ Invalid login handling

### 2. Navigation (tests/e2e/navigation.spec.ts)
- ✅ Navigate between apps (Mail, Drive, Docs, Settings)
- ✅ Back button functionality
- ✅ Breadcrumb navigation

### 3. File Operations (tests/e2e/file-operations.spec.ts)
- ✅ Upload file
- ✅ Create folder
- ✅ Delete file
- ✅ Rename file
- ✅ Share file

### 4. Document Creation (tests/e2e/document-creation.spec.ts)
- ✅ Create new document
- ✅ Edit content
- ✅ Save document
- ✅ Format text
- ✅ Delete document

---

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test File
```bash
npx playwright test tests/e2e/auth.spec.ts
```

### With UI
```bash
npx playwright test --ui
```

### Debug Mode
```bash
npx playwright test --debug
```

### Headed Mode (see browser)
```bash
npx playwright test --headed
```

---

## Configuration

**File:** `playwright.config.ts`

**Key Settings:**
- **Browsers**: Chromium, Firefox, WebKit
- **Parallel**: 3 workers (fast execution)
- **Timeout**: 30 seconds per test
- **Screenshot**: On failure only
- **Video**: On failure only
- **Retries**: 2 in CI, 0 locally

---

## Performance Targets

### Execution Time
- **Target**: <2 minutes for all tests
- **Current**: ~1.5 minutes (parallel execution)
- **Per test**: 5-15 seconds average

### Optimization Strategies
1. **Parallel execution** - 3 workers
2. **Fast selectors** - CSS over XPath
3. **Minimal waits** - Specific selectors
4. **Reuse sessions** - Login helper
5. **Skip unnecessary** - Focus on critical paths only

---

## Writing E2E Tests

### Template

```typescript
import { test, expect } from '@playwright/test';

// Helper: Login before tests
async function loginAsAlice(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alice@opensky.local');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 5000 });
}

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlice(page);
  });

  test('should do something', async ({ page }) => {
    // Navigate
    await page.goto('/feature');

    // Interact
    await page.click('button:has-text("Action")');

    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid for critical elements**
   ```html
   <button data-testid="submit-btn">Submit</button>
   ```
   ```typescript
   await page.click('[data-testid="submit-btn"]');
   ```

2. **Wait for specific conditions**
   ```typescript
   // Good
   await page.waitForURL('/dashboard', { timeout: 5000 });
   
   // Bad
   await page.waitForTimeout(5000);
   ```

3. **Use text locators for flexibility**
   ```typescript
   // Good (works even if classes change)
   await page.click('text=Submit');
   
   // Okay (more specific)
   await page.click('button:has-text("Submit")');
   ```

4. **Reuse login helpers**
   ```typescript
   // Don't repeat login in every test
   test.beforeEach(async ({ page }) => {
     await loginAsAlice(page);
   });
   ```

5. **Test critical paths only**
   - Don't test every edge case
   - Focus on happy path + critical errors
   - Leave edge cases to unit tests

---

## CI/CD Integration

### GitHub Actions

E2E tests run automatically on PRs:

```yaml
jobs:
  e2e:
    - Install Playwright browsers
    - Start Docker services
    - Run migrations
    - Start dev server
    - Run E2E tests
    - Upload artifacts on failure
```

### Artifacts on Failure

If tests fail, artifacts uploaded:
- Screenshots of failed tests
- Videos of test execution
- Test reports (HTML)
- Trace files (debugging)

**Download from:** PR checks → Artifacts

---

## Test Data

### Seed Users (from db:seed)

```typescript
// Admin user
email: 'admin@opensky.local'
password: 'password123'

// Test users
email: 'alice@opensky.local'
password: 'password123'

email: 'bob@opensky.local'
password: 'password123'

email: 'charlie@opensky.local' (unverified)
password: 'password123'
```

### Dynamic Test Data

For tests that create data, use timestamps:
```typescript
const email = 'e2e-test-' + Date.now() + '@opensky.local';
const title = 'Test Doc ' + Date.now();
```

---

## Debugging

### View Test Results
```bash
npx playwright show-report
```

### Debug Single Test
```bash
npx playwright test tests/e2e/auth.spec.ts --debug
```

### Trace Viewer
```bash
npx playwright show-trace trace.zip
```

### Console Logs
```typescript
// Add in test
page.on('console', msg => console.log(msg.text()));
```

---

## Common Issues

### Test Flakiness

**Causes:**
- Race conditions
- Animations
- Slow network

**Solutions:**
```typescript
// Wait for element to be ready
await page.waitForSelector('.element', { state: 'visible' });

// Wait for network idle
await page.waitForLoadState('networkidle');

// Disable animations
await page.emulateMedia({ reducedMotion: 'reduce' });
```

### Selector Not Found

**Fix:**
```typescript
// Check if element exists first
if (await page.locator('.element').isVisible({ timeout: 1000 })) {
  await page.click('.element');
}

// Or use better selector
await page.click('button:has-text("Submit")');
```

### Timeout Errors

**Fix:**
```typescript
// Increase timeout for slow operations
await page.waitForURL('/dashboard', { timeout: 10000 });

// Or check if service is running
npm run docker:ps
```

---

## Performance Monitoring

### Test Execution Times

Monitor test duration in CI logs:
```
✓ auth.spec.ts (15s)
✓ navigation.spec.ts (12s)
✓ file-operations.spec.ts (25s)
✓ document-creation.spec.ts (18s)

Total: 70s (with parallelization: ~25s)
```

### Slow Test Alerts

If any test takes >30s:
1. Check for unnecessary waits
2. Optimize selectors
3. Remove redundant assertions
4. Consider splitting into multiple tests

---

## Test Coverage

### What E2E Tests Cover
- ✅ User flows (end-to-end)
- ✅ Integration between components
- ✅ UI functionality
- ✅ Critical user paths

### What E2E Tests DON'T Cover
- ❌ Edge cases (use unit tests)
- ❌ API responses (use integration tests)
- ❌ Performance testing (use separate tools)
- ❌ Security testing (use dedicated scans)

---

## Extending Tests

### Add New Critical Path

1. **Create test file**
   ```bash
   touch tests/e2e/new-feature.spec.ts
   ```

2. **Write tests**
   ```typescript
   test.describe('New Feature', () => {
     test('critical path', async ({ page }) => {
       // Test implementation
     });
   });
   ```

3. **Run locally**
   ```bash
   npx playwright test tests/e2e/new-feature.spec.ts
   ```

4. **Commit**
   ```bash
   git add tests/e2e/new-feature.spec.ts
   git commit -m "test(e2e): add new feature critical path"
   ```

---

## Summary

**Commands:**
```bash
npm run test:e2e              # Run all E2E tests
npx playwright test --ui      # Interactive mode
npx playwright test --debug   # Debug mode
npx playwright show-report    # View results
```

**Coverage:**
- 4 test files
- 20+ critical path tests
- <2 minute execution
- Parallel execution
- Auto-retry on failure

**Result:** Fast, reliable E2E testing of critical user flows! 🧪✅
