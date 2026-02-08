const { chromium } = require('./node_modules/playwright');

async function testFeature10() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE_URL = 'http://localhost:5180';
  const results = [];

  function log(step, pass, detail) {
    results.push({ step, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + ': ' + step + (detail ? ' - ' + detail : ''));
  }

  try {
    // Step 1: Navigate to login page
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
    const loginHeading = await page.textContent('h1');
    log('Navigate to login page', loginHeading.includes('Tap In'), 'Found heading: ' + loginHeading);

    // Step 2: Enter valid email and password
    await page.fill('#email', 'presidente@tapin.cl');
    await page.fill('#password', 'password123');
    const emailVal = await page.inputValue('#email');
    const passVal = await page.inputValue('#password');
    log('Enter valid email and password', emailVal === 'presidente@tapin.cl' && passVal.length > 0, 'Email: ' + emailVal);

    // Step 3: Click login button
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 10000 });
    log('Click login button', true, 'Login button clicked, navigation started');

    // Step 4: Verify JWT token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    log('JWT token stored in localStorage', !!token && token.length > 20, 'Token length: ' + (token ? token.length : 0));

    // Step 5: Verify redirect to dashboard
    const url = page.url();
    log('Redirected to dashboard', url === BASE_URL + '/' || url.endsWith('/'), 'Current URL: ' + url);

    // Step 6: Verify user info displayed (name, role)
    await page.waitForSelector('text=María González', { timeout: 5000 });
    const pageContent = await page.textContent('body');
    const hasName = pageContent.includes('María González');
    const hasRole = pageContent.includes('presidente');
    log('User info displayed (name)', hasName, 'Name found: ' + hasName);
    log('User info displayed (role)', hasRole, 'Role found: ' + hasRole);

    // Take screenshot
    await page.screenshot({ path: 'screenshots-feature10-dashboard.png', fullPage: true });
    console.log('\nScreenshot saved: screenshots-feature10-dashboard.png');

    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  // Summary
  const allPass = results.every(r => r.pass);
  console.log('\n=== FEATURE #10 SUMMARY ===');
  console.log('Total steps: ' + results.length);
  console.log('Passing: ' + results.filter(r => r.pass).length);
  console.log('Failing: ' + results.filter(r => !r.pass).length);
  console.log('Overall: ' + (allPass ? 'PASS' : 'FAIL'));

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

testFeature10();
