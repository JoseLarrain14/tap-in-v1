// Feature #104 Test: Network Error UI on Ingresos page
// Tests: normal load, network error display, and recovery via retry button

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = { phase1: {}, phase2: {}, phase3: {} };

  // =========================================================================
  // PHASE 1: Login normally and verify Ingresos page works
  // =========================================================================
  console.log('\n=== PHASE 1: Login and verify normal Ingresos page ===');
  try {
    // Step 1: Navigate to login
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('[OK] Step 1: Navigated to /login');

    // Step 2: Fill credentials
    await page.fill('input[type="email"], input[name="email"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    console.log('[OK] Step 2: Filled email and password');

    // Step 3: Click "Ingresar"
    await page.click('button:has-text("Ingresar")');
    console.log('[OK] Step 3: Clicked Ingresar button');

    // Step 4: Wait for redirect to dashboard
    await page.waitForURL('**/');
    // Also wait for the page to be fully loaded
    await page.waitForTimeout(2000);
    console.log('[OK] Step 4: Redirected to dashboard, URL:', page.url());

    // Step 5: Navigate to ingresos
    await page.goto('http://localhost:5174/ingresos', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('[OK] Step 5: Navigated to /ingresos');

    // Step 6: Take screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-ingresos-normal.png', fullPage: true });
    console.log('[OK] Step 6: Screenshot saved as feat104-ingresos-normal.png');

    // Verify the page loaded properly (no error state)
    const hasTable = await page.locator('table').count() > 0;
    const hasEmptyState = (await page.locator('text=No hay ingresos registrados').count()) > 0;
    const hasFilterBar = (await page.locator('[data-testid="filter-bar"]').count()) > 0;
    const hasNetworkError = (await page.locator('[data-testid="network-error"]').count()) > 0;

    if (hasTable || hasEmptyState || hasFilterBar) {
      console.log('[OK] Page loaded normally - table:', hasTable, ', empty state:', hasEmptyState, ', filter bar:', hasFilterBar);
    } else {
      console.log('[WARN] Page may not have loaded correctly');
    }
    console.log('[INFO] Network error visible:', hasNetworkError, '(should be false)');

    results.phase1 = { success: true, hasTable, hasEmptyState, hasFilterBar, hasNetworkError };
  } catch (err) {
    console.log('[FAIL] Phase 1 error:', err.message);
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-ingresos-normal.png', fullPage: true });
    results.phase1 = { success: false, error: err.message };
  }

  // =========================================================================
  // PHASE 2: Simulate network error
  // =========================================================================
  console.log('\n=== PHASE 2: Simulate network error ===');
  try {
    // Step 7: Intercept API requests (except /api/auth/me) and abort them
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        // Let auth requests through so the user stays logged in
        await route.continue();
      } else {
        // Abort all other API requests to simulate server down
        await route.abort('connectionrefused');
      }
    });
    console.log('[OK] Step 7: Route interception set up - blocking all /api/* except /api/auth/me');

    // Step 8: Navigate to /ingresos to trigger fresh load with error
    await page.goto('http://localhost:5174/ingresos', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('[OK] Step 8: Navigated to /ingresos (fresh load)');

    // Step 9: Wait for error to appear
    await page.waitForTimeout(3000);
    console.log('[OK] Step 9: Waited 3 seconds for error state');

    // Step 10: Take screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-network-error-clean.png', fullPage: true });
    console.log('[OK] Step 10: Screenshot saved as feat104-network-error-clean.png');

    // Step 11: Verify network error component
    const networkErrorEl = page.locator('[data-testid="network-error"]');
    const networkErrorVisible = await networkErrorEl.isVisible().catch(() => false);
    console.log('[INFO] Step 11: Network error component visible:', networkErrorVisible);

    if (networkErrorVisible) {
      const errorText = await networkErrorEl.textContent();
      const hasCorrectMessage = errorText.includes('Sin conexión al servidor') || errorText.includes('No se pudo conectar');
      console.log('[INFO] Step 11: Contains correct message text:', hasCorrectMessage);
      console.log('[INFO] Step 11: Error text snippet:', errorText.substring(0, 200));
    } else {
      console.log('[FAIL] Step 11: Network error component NOT visible');
      // Let's inspect what's on the page
      const bodyText = await page.locator('body').textContent();
      console.log('[DEBUG] Page body text (first 500 chars):', bodyText.substring(0, 500));
    }

    // Step 12: Verify retry button exists
    const retryBtn = page.locator('[data-testid="network-error-retry"]');
    const retryBtnVisible = await retryBtn.isVisible().catch(() => false);
    console.log('[INFO] Step 12: Retry button visible:', retryBtnVisible);

    // Step 13: Verify no empty state showing
    const emptyStateVisible = await page.locator('text=No hay ingresos registrados').isVisible().catch(() => false);
    console.log('[INFO] Step 13: Empty state ("No hay ingresos registrados") visible:', emptyStateVisible, '(should be false)');

    results.phase2 = {
      success: networkErrorVisible && retryBtnVisible && !emptyStateVisible,
      networkErrorVisible,
      retryBtnVisible,
      emptyStateHidden: !emptyStateVisible
    };

    if (results.phase2.success) {
      console.log('[OK] Phase 2: All checks passed!');
    } else {
      console.log('[FAIL] Phase 2: Some checks failed');
    }
  } catch (err) {
    console.log('[FAIL] Phase 2 error:', err.message);
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-network-error-clean.png', fullPage: true }).catch(() => {});
    results.phase2 = { success: false, error: err.message };
  }

  // =========================================================================
  // PHASE 3: Test recovery via retry button
  // =========================================================================
  console.log('\n=== PHASE 3: Test recovery ===');
  try {
    // Step 14: Remove route interception
    await page.unroute('**/api/**');
    console.log('[OK] Step 14: Route interception removed');

    // Step 15: Click the retry button
    const retryBtn = page.locator('[data-testid="network-error-retry"]');
    await retryBtn.click();
    console.log('[OK] Step 15: Clicked retry button');

    // Step 16: Wait for data to load
    await page.waitForTimeout(3000);
    console.log('[OK] Step 16: Waited 3 seconds for data to load');

    // Step 17: Take screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-recovery.png', fullPage: true });
    console.log('[OK] Step 17: Screenshot saved as feat104-recovery.png');

    // Verify recovery - the network error should be gone and data/empty state should be visible
    const networkErrorGone = !(await page.locator('[data-testid="network-error"]').isVisible().catch(() => false));
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=No hay ingresos registrados').isVisible().catch(() => false);
    const hasFilterBar = await page.locator('[data-testid="filter-bar"]').isVisible().catch(() => false);

    console.log('[INFO] Network error gone:', networkErrorGone);
    console.log('[INFO] Table visible:', hasTable);
    console.log('[INFO] Empty state visible:', hasEmptyState);
    console.log('[INFO] Filter bar visible:', hasFilterBar);

    const recovered = networkErrorGone && (hasTable || hasEmptyState || hasFilterBar);
    results.phase3 = { success: recovered, networkErrorGone, hasTable, hasEmptyState, hasFilterBar };

    if (recovered) {
      console.log('[OK] Phase 3: Recovery successful! Data loaded after retry.');
    } else {
      console.log('[FAIL] Phase 3: Recovery may not have worked fully');
    }
  } catch (err) {
    console.log('[FAIL] Phase 3 error:', err.message);
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-recovery.png', fullPage: true }).catch(() => {});
    results.phase3 = { success: false, error: err.message };
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n=== SUMMARY ===');
  console.log('Phase 1 (Normal Load):', results.phase1.success ? 'PASSED' : 'FAILED');
  console.log('Phase 2 (Network Error):', results.phase2.success ? 'PASSED' : 'FAILED');
  console.log('Phase 3 (Recovery):', results.phase3.success ? 'PASSED' : 'FAILED');
  console.log('\nFull results:', JSON.stringify(results, null, 2));

  await browser.close();
})();
