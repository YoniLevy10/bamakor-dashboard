# Playwright QA Testing - Bamakor Dashboard

## Overview

Basic end-to-end QA test coverage for the Bamakor Dashboard using Playwright. This test suite verifies:

- ✅ Dashboard page loads successfully
- ✅ Navigation renders and is functional
- ✅ Main action buttons are visible
- ✅ Modal/drawer interactions work
- ✅ Mobile responsiveness (iPhone 12 + Pixel 5)
- ✅ No console errors on load

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install `@playwright/test` as defined in `package.json`.

### 2. Install Playwright Browsers

```bash
npx playwright install
```

This downloads Chrome, Firefox, and Safari browsers needed for testing.

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests with UI (Interactive Mode)
```bash
npm run test:e2e:ui
```
Shows a visual interface where you can see tests run in real-time and debug failures.

### Run Tests in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```
Same as normal but shows the browser window (useful for debugging).

### Run Tests in Debug Mode
```bash
npm run test:e2e:debug
```
Opens the Playwright Inspector for step-by-step debugging.

### Run Specific Test File
```bash
npx playwright test tests/e2e/dashboard.spec.ts
```

### Run Specific Test
```bash
npx playwright test -g "Dashboard page loads successfully"
```

### Run on Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Test Structure

### `tests/e2e/dashboard.spec.ts`
Core dashboard functionality tests:
- Page load verification
- Navigation links visibility
- Button visibility and functionality
- Modal/drawer interactions
- KPI card rendering

### `tests/e2e/mobile.spec.ts`
Mobile-specific tests:
- iPhone 12 (iOS) viewport testing
- Pixel 5 (Android) viewport testing
- Touch-friendly button sizing
- Mobile navigation accessibility
- Responsive layout verification

## Viewing Test Results

After running tests, Playwright generates an HTML report:

```bash
npx playwright show-report
```

This opens a detailed report showing:
- ✅ Passed/failed tests
- 📸 Screenshots of failures
- 📹 Recorded traces
- ⏱️ Test execution times

## Test Browsers & Devices

By default, tests run on:
- **Desktop**: Chromium, Firefox, WebKit (Safari)
- **Mobile**: iPhone 12, Pixel 5

Configure in `playwright.config.ts` to add/remove browsers.

## Continuous Integration (CI)

For GitHub Actions or other CI/CD:

```bash
npm run test:e2e
```

Tests automatically:
- Run headless (no UI)
- Retry failed tests twice
- Collect traces for debugging
- Generate HTML report

## Troubleshooting

### Tests fail with "Connection refused"
Make sure the dev server is running:
```bash
npm run dev
```
in a separate terminal before running tests.

### Tests timeout waiting for elements
Increase timeout in playwright.config.ts:
```typescript
use: {
  navigationTimeout: 30000,
  actionTimeout: 10000,
}
```

### Flaky tests (intermittent failures)
- Use more specific selectors (avoid generic divs)
- Add explicit waits: `await page.waitForTimeout(500)`
- Use `page.waitForSelector()` for dynamic content

### Cannot find browser
Reinstall browsers:
```bash
npx playwright install --with-deps
```

## Test Limitations

This is a **basic smoke test suite**, not comprehensive coverage. Current tests:
- ✅ Verify pages load without crashing
- ✅ Check navigation works
- ✅ Test button visibility and clicks
- ✅ Verify modal/drawer opens
- ✅ Test mobile layouts

They do **NOT**:
- ❌ Test complex user workflows
- ❌ Verify data accuracy
- ❌ Test backend API calls
- ❌ Check accessibility (WCAG compliance)

## Adding More Tests

Example test structure:
```typescript
test('My new test', async ({ page }) => {
  await page.goto('/tickets')
  
  const element = page.locator('button', { hasText: 'Action' })
  await expect(element).toBeVisible()
  
  await element.click()
  
  await expect(page).toHaveURL(/\/tickets/)
})
```

Playwright selectors:
- `page.locator('button')` - CSS selector
- `page.locator('button', { hasText: 'text' })` - Element containing text
- `page.locator('[data-testid="id"]')` - Data attributes (if added to app)

## Performance & Timing

- **Single test run**: ~5-10 seconds (headless)
- **Full suite (all browsers/devices)**: ~1-2 minutes
- **With UI mode**: Real-time, interactive
- **On CI**: ~2-3 minutes (with retries)

## Next Steps

1. **Run tests locally**: `npm run test:e2e`
2. **View interactive UI**: `npm run test:e2e:ui`
3. **Check report**: `npx playwright show-report`
4. **Add more tests** as needed for critical flows
5. **Integrate with CI/CD** for automated testing

---

For more Playwright docs: https://playwright.dev
