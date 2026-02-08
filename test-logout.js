// Test Feature #12: User can logout successfully
// Uses Playwright to verify through UI

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE = 'http://localhost:5178';
  let passed = true;

  try {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigate to login page...');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#email');
    console.log('  Login page loaded');

    // Step 2: Login with valid credentials
    console.log('Step 2: Login with valid credentials...');
    await page.fill('#email', 'presidente@tapin.cl');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });
    console.log('  Logged in, URL:', page.url());

    // Step 3: Verify token is stored
    console.log('Step 3: Verify JWT token is stored...');
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    if (tokenBefore) {
      console.log('  Token exists in localStorage:', tokenBefore.substring(0, 30) + '...');
    } else {
      console.log('  FAIL: No token found in localStorage');
      passed = false;
    }

    // Step 4: Click logout button
    console.log('Step 4: Click logout button...');
    const logoutBtn = await page.locator('text=Cerrar sesión');
    await logoutBtn.waitFor({ timeout: 5000 });
    console.log('  Found "Cerrar sesión" button');
    await logoutBtn.click();

    // Wait for navigation to login page
    await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
    console.log('  Redirected to:', page.url());

    // Step 5: Verify token is cleared
    console.log('Step 5: Verify JWT token is cleared...');
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    if (tokenAfter === null) {
      console.log('  Token cleared from localStorage');
    } else {
      console.log('  FAIL: Token still exists:', tokenAfter);
      passed = false;
    }

    // Step 6: Verify URL is /login
    console.log('Step 6: Verify URL is /login...');
    if (page.url().includes('/login')) {
      console.log('  Correctly on login page');
    } else {
      console.log('  FAIL: Not on login page, URL:', page.url());
      passed = false;
    }

    // Step 7: Try accessing protected route
    console.log('Step 7: Try accessing protected route...');
    await page.goto(`${BASE}/`);
    await page.waitForURL('**/login', { timeout: 10000 });
    console.log('  Protected route redirected to login:', page.url());

    if (page.url().includes('/login')) {
      console.log('  Correctly redirected to login');
    } else {
      console.log('  FAIL: Not redirected, URL:', page.url());
      passed = false;
    }

    // Take a screenshot
    await page.screenshot({ path: '/c/Users/josel/CPP/feature12-logout.png' });
    console.log('  Screenshot saved');

  } catch (err) {
    console.error('Test error:', err.message);
    passed = false;
  } finally {
    await browser.close();
  }

  console.log('\n=== Feature #12 Result:', passed ? 'PASSED' : 'FAILED', '===');
  process.exit(passed ? 0 : 1);
})();
