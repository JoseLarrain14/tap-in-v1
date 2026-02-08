const { chromium } = require('playwright');
const path = require('path');

const FRONTEND_URL = 'http://localhost:5177';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-feature22');

async function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function main() {
  var browser = await chromium.launch({ headless: true });
  var context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var page = await context.newPage();

  try {
    // Step 1: Navigate to login page
    console.log('=== Step 1: Navigate to login page ===');
    await page.goto(FRONTEND_URL + '/login', { waitUntil: 'networkidle', timeout: 15000 });
    await delay(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step01-login-page.png'), fullPage: true });
    console.log('Screenshot: step01-login-page.png');

    // Step 2: Login as presidente
    console.log('=== Step 2: Login as presidente ===');
    await page.fill('input[type="email"], input[name="email"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step02-presidente-dashboard.png'), fullPage: true });
    console.log('Screenshot: step02-presidente-dashboard.png');

    // Step 3: Navigate to /configuracion
    console.log('=== Step 3: Navigate to settings/users ===');
    await page.goto(FRONTEND_URL + '/configuracion', { waitUntil: 'networkidle', timeout: 15000 });
    await delay(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step03-users-list.png'), fullPage: true });
    console.log('Screenshot: step03-users-list.png');

    // Step 4: Find and click Desactivar button for delegado user
    console.log('=== Step 4: Deactivate delegado user ===');
    // Look for a button with text "Desactivar" near Carlos Lopez
    var desactivarButton = await page.locator('text=Desactivar').first();
    if (await desactivarButton.isVisible()) {
      await desactivarButton.click();
      await delay(1500);
    } else {
      // Try alternative: look for deactivate buttons
      var buttons = await page.locator('button:has-text("Desactivar")').all();
      console.log('Found ' + buttons.length + ' Desactivar buttons');
      if (buttons.length > 0) {
        await buttons[0].click();
        await delay(1500);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step04-user-deactivated.png'), fullPage: true });
    console.log('Screenshot: step04-user-deactivated.png');

    // Step 5: Log out
    console.log('=== Step 5: Log out ===');
    // Try to find logout button or link
    var logoutButton = await page.locator('text=Cerrar').first();
    if (await logoutButton.isVisible().catch(function() { return false; })) {
      await logoutButton.click();
      await delay(1000);
    } else {
      // Try navigating directly to login page and clearing storage
      await page.evaluate(function() {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto(FRONTEND_URL + '/login', { waitUntil: 'networkidle', timeout: 15000 });
      await delay(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step05-logged-out.png'), fullPage: true });
    console.log('Screenshot: step05-logged-out.png');

    // Step 6: Login as deactivated delegado
    console.log('=== Step 6: Login as deactivated delegado ===');
    await page.goto(FRONTEND_URL + '/login', { waitUntil: 'networkidle', timeout: 15000 });
    await delay(500);
    await page.fill('input[type="email"], input[name="email"]', 'delegado@tapin.cl');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step06-delegado-after-login.png'), fullPage: true });
    console.log('Screenshot: step06-delegado-after-login.png');
    console.log('Current URL:', page.url());

    // Step 7: Navigate to dashboard
    console.log('=== Step 7: Verify dashboard access ===');
    await page.goto(FRONTEND_URL + '/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    await delay(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step07-delegado-dashboard.png'), fullPage: true });
    console.log('Screenshot: step07-delegado-dashboard.png');
    console.log('Current URL:', page.url());

    // Step 8: Navigate to /solicitudes
    console.log('=== Step 8: Verify pipeline access ===');
    await page.goto(FRONTEND_URL + '/solicitudes', { waitUntil: 'networkidle', timeout: 15000 });
    await delay(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step08-delegado-solicitudes.png'), fullPage: true });
    console.log('Screenshot: step08-delegado-solicitudes.png');
    console.log('Current URL:', page.url());

    // Cleanup: re-activate the user via API
    console.log('\n=== Cleanup: Re-activate delegado via API ===');
    // Login as presidente via API to get token
    var presResponse = await page.evaluate(async function() {
      var res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' })
      });
      return res.json();
    });
    if (presResponse.token) {
      await page.evaluate(async function(token) {
        await fetch('http://localhost:3001/api/users/3/activate', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: '{}'
        });
      }, presResponse.token);
      console.log('Delegado user re-activated');
    }

    console.log('\nAll screenshots saved to:', SCREENSHOTS_DIR);

  } catch (err) {
    console.error('Error during browser test:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-screenshot.png'), fullPage: true });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

main();
