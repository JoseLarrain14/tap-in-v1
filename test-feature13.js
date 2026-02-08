const { chromium } = require('./node_modules/playwright');

async function testFeature13() {
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
    // Step 1: Clear all tokens/cookies
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    log('Clear all tokens/cookies', true, 'localStorage and sessionStorage cleared');

    // Step 2 & 3: Navigate directly to / (dashboard) -> verify redirect to login
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    var currentUrl = page.url();
    log('Navigate to /dashboard -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Take screenshot
    await page.screenshot({ path: 'screenshots-feature13-redirect-dashboard.png' });

    // Step 4 & 5: Navigate directly to /ingresos -> verify redirect to login
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE_URL + '/ingresos', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    currentUrl = page.url();
    log('Navigate to /ingresos -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Step 6 & 7: Navigate directly to /solicitudes (egresos) -> verify redirect to login
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE_URL + '/solicitudes', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    currentUrl = page.url();
    log('Navigate to /egresos(solicitudes) -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Extra: test /reportes too
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE_URL + '/reportes', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    currentUrl = page.url();
    log('Navigate to /reportes -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Extra: test /notificaciones too
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE_URL + '/notificaciones', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    currentUrl = page.url();
    log('Navigate to /notificaciones -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Extra: test /configuracion too
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE_URL + '/configuracion', { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 5000 });
    currentUrl = page.url();
    log('Navigate to /configuracion -> redirect to login', currentUrl.includes('/login'), 'URL: ' + currentUrl);

    // Verify login page actually renders (not just URL)
    const hasLoginForm = await page.$('input#email');
    const hasPasswordField = await page.$('input#password');
    const hasSubmitBtn = await page.$('button[type="submit"]');
    log('Login page renders with form', !!hasLoginForm && !!hasPasswordField && !!hasSubmitBtn, 'Form elements found');

    await page.screenshot({ path: 'screenshots-feature13-login-redirect.png' });
    console.log('\nScreenshots saved');

  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  // Summary
  const allPass = results.every(r => r.pass);
  console.log('\n=== FEATURE #13 SUMMARY ===');
  console.log('Total steps: ' + results.length);
  console.log('Passing: ' + results.filter(r => r.pass).length);
  console.log('Failing: ' + results.filter(r => !r.pass).length);
  console.log('Overall: ' + (allPass ? 'PASS' : 'FAIL'));

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

testFeature13();
