// Test Feature #14: JWT session persists across page refreshes
// Uses Playwright to verify through UI

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE = 'http://localhost:5178';
  let passed = true;

  try {
    // Step 1: Login
    console.log('Step 1: Login as presidente...');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#email');
    await page.fill('#email', 'presidente@tapin.cl');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });
    console.log('  Logged in, URL:', page.url());

    // Step 2: Verify dashboard is displayed
    console.log('Step 2: Verify dashboard is displayed...');
    const dashboardContent = await page.textContent('body');
    if (dashboardContent.includes('Dashboard') || dashboardContent.includes('Tap In')) {
      console.log('  Dashboard content found');
    } else {
      console.log('  WARNING: Dashboard content not clearly visible');
    }

    // Check user info is displayed
    const userName = await page.textContent('body');
    if (userName.includes('María González') || userName.includes('presidente')) {
      console.log('  User info displayed: María González / presidente');
    } else {
      console.log('  WARNING: User info not found in page');
    }

    // Step 3: Verify token exists before refresh
    console.log('Step 3: Verify token exists before refresh...');
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    if (tokenBefore) {
      console.log('  Token in localStorage:', tokenBefore.substring(0, 30) + '...');
    } else {
      console.log('  FAIL: No token in localStorage before refresh');
      passed = false;
    }

    // Step 4: Refresh the page (simulate F5)
    console.log('Step 4: Refresh the page...');
    await page.reload({ waitUntil: 'networkidle' });
    console.log('  Page reloaded');

    // Step 5: Verify still authenticated
    console.log('Step 5: Verify still authenticated after refresh...');

    // Wait a moment for auth context to initialize
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log('  Current URL:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('  FAIL: Redirected to login page after refresh');
      passed = false;
    } else {
      console.log('  Still on dashboard (not redirected to login)');
    }

    // Step 6: Verify token still exists after refresh
    console.log('Step 6: Verify token still exists after refresh...');
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    if (tokenAfter) {
      console.log('  Token still in localStorage:', tokenAfter.substring(0, 30) + '...');
      if (tokenAfter === tokenBefore) {
        console.log('  Token is the same as before refresh');
      }
    } else {
      console.log('  FAIL: Token was lost after refresh');
      passed = false;
    }

    // Step 7: Verify user info still displays correctly
    console.log('Step 7: Verify user info still displays correctly...');
    const bodyAfterRefresh = await page.textContent('body');

    if (bodyAfterRefresh.includes('María González')) {
      console.log('  User name "María González" still displayed');
    } else {
      console.log('  FAIL: User name not found after refresh');
      passed = false;
    }

    if (bodyAfterRefresh.includes('presidente')) {
      console.log('  User role "presidente" still displayed');
    } else {
      console.log('  WARNING: User role not found after refresh');
    }

    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Do another refresh to capture any console errors
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (consoleErrors.length > 0) {
      console.log('  Console errors:', consoleErrors);
    } else {
      console.log('  No console errors detected');
    }

    // Final URL check
    const finalUrl = page.url();
    if (!finalUrl.includes('/login')) {
      console.log('  Still authenticated after second refresh');
    } else {
      console.log('  FAIL: Lost authentication after second refresh');
      passed = false;
    }

  } catch (err) {
    console.error('Test error:', err.message);
    passed = false;
  } finally {
    await browser.close();
  }

  console.log('\n=== Feature #14 Result:', passed ? 'PASSED' : 'FAILED', '===');
  process.exit(passed ? 0 : 1);
})();
