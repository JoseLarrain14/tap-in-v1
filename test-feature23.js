const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOT_DIR = path.join('C:', 'Users', 'josel', 'CPP', 'screenshots-feature23');
const FRONTEND_URL = 'http://localhost:5177';
const BACKEND_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    // ===== STEP 1: Navigate to login page =====
    console.log('Step 1: Navigating to login page...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    console.log('  -> Login page loaded. Title:', await page.title());

    // ===== STEP 2: Login as presidente =====
    console.log('Step 2: Logging in as presidente@tapin.cl...');
    await page.fill('input#email', 'presidente@tapin.cl');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/');
    await page.waitForTimeout(1000);
    console.log('  -> Logged in successfully. Current URL:', page.url());

    // ===== STEP 3: Navigate to /configuracion =====
    console.log('Step 3: Navigating to /configuracion...');
    await page.goto(`${FRONTEND_URL}/configuracion`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    console.log('  -> Configuracion page loaded. URL:', page.url());

    // ===== STEP 4: Screenshot showing users list and "Invitar Usuario" button =====
    console.log('Step 4: Taking screenshot of users list...');
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
      console.log('  -> WARNING: No table found');
    });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-users-list-and-invite-button.png'),
      fullPage: true
    });
    console.log('  -> Screenshot saved: 01-users-list-and-invite-button.png');

    // Check if "+ Invitar Usuario" button exists
    const inviteButton = await page.locator('button:has-text("Invitar Usuario")');
    const inviteButtonVisible = await inviteButton.isVisible();
    console.log('  -> "+ Invitar Usuario" button visible:', inviteButtonVisible);

    // ===== STEP 5: Click "+ Invitar Usuario" button =====
    console.log('Step 5: Clicking "+ Invitar Usuario" button...');
    await inviteButton.click();
    await page.waitForTimeout(500);

    // ===== STEP 6: Screenshot showing the invite modal =====
    console.log('Step 6: Taking screenshot of invite modal...');
    await page.waitForSelector('.fixed', { timeout: 5000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-invite-modal.png'),
      fullPage: true
    });
    console.log('  -> Screenshot saved: 02-invite-modal.png');

    // ===== STEP 7: Fill in the form =====
    console.log('Step 7: Filling in invite form...');

    // Get all inputs inside the modal (.fixed overlay)
    const modal = page.locator('.fixed');

    // Fill "Nombre completo" - first text input in the modal
    const nameInput = modal.locator('input[type="text"]').first();
    await nameInput.fill('Test Delegado F23');
    console.log('  -> Filled nombre: Test Delegado F23');

    // Fill "Email" - email input in the modal
    const emailInput = modal.locator('input[type="email"]');
    await emailInput.fill('test_f23_delegado@tapin.cl');
    console.log('  -> Filled email: test_f23_delegado@tapin.cl');

    // Check that Delegado is already selected (default)
    const roleSelect = modal.locator('select');
    const selectedRole = await roleSelect.inputValue();
    console.log('  -> Current role selection:', selectedRole);
    if (selectedRole === 'delegado') {
      console.log('  -> PASS: Delegado is default role as expected');
    } else {
      console.log('  -> NOTE: Default role is not delegado, selecting it...');
      await roleSelect.selectOption('delegado');
    }

    // ===== STEP 8: Click "Invitar" button =====
    console.log('Step 8: Clicking "Invitar" button...');
    const submitButton = modal.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(2000);

    // ===== STEP 9: Screenshot showing success feedback =====
    console.log('Step 9: Taking screenshot of success feedback...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-success-feedback.png'),
      fullPage: true
    });
    console.log('  -> Screenshot saved: 03-success-feedback.png');

    // Check for success feedback
    const successFeedback = await page.locator('.bg-green-50').isVisible().catch(() => false);
    const errorFeedback = await page.locator('.bg-red-50').isVisible().catch(() => false);

    if (successFeedback) {
      const feedbackText = await page.locator('.bg-green-50').textContent();
      console.log('  -> SUCCESS feedback found:', feedbackText.trim());
    } else if (errorFeedback) {
      const errorText = await page.locator('.bg-red-50').textContent();
      console.log('  -> ERROR feedback found:', errorText.trim());
    } else {
      console.log('  -> WARNING: No feedback message found');
    }

    // ===== STEP 10 & 11: Verify new user in list and screenshot =====
    console.log('Step 10-11: Verifying new user in list...');
    await page.waitForTimeout(1000);

    // Check if new user appears
    const newUserCell = page.locator('td:has-text("Test Delegado F23")');
    const newUserVisible = await newUserCell.isVisible().catch(() => false);
    console.log('  -> "Test Delegado F23" visible in table:', newUserVisible);

    const newUserEmail = page.locator('td:has-text("test_f23_delegado@tapin.cl")');
    const newUserEmailVisible = await newUserEmail.isVisible().catch(() => false);
    console.log('  -> "test_f23_delegado@tapin.cl" visible in table:', newUserEmailVisible);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-updated-user-list.png'),
      fullPage: true
    });
    console.log('  -> Screenshot saved: 04-updated-user-list.png');

    // ===== STEP 12: Verify via API =====
    console.log('Step 12: Verifying via API GET /api/users...');

    // Use fetch in the page context to call the API
    const apiResult = await page.evaluate(async (backendUrl) => {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${backendUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { status: resp.status, data: await resp.json() };
    }, BACKEND_URL);

    console.log('  -> API Response status:', apiResult.status);
    console.log('  -> Total users:', apiResult.data.users?.length || 0);

    const apiNewUser = apiResult.data.users?.find(u => u.email === 'test_f23_delegado@tapin.cl');
    if (apiNewUser) {
      console.log('  -> PASS: New user found in API response:', JSON.stringify(apiNewUser));
    } else {
      console.log('  -> FAIL: New user NOT found in API response');
      console.log('  -> All users in API:', JSON.stringify(apiResult.data.users?.map(u => ({ name: u.name, email: u.email, role: u.role }))));
    }

    // ===== SUMMARY =====
    console.log('\n===== TEST SUMMARY =====');
    console.log('Feature #23: Presidente can invite new users to CPP');
    console.log('  1. Login as Presidente:            PASS');
    console.log('  2. Navigate to /configuracion:      PASS');
    console.log('  3. "+ Invitar Usuario" button:      ' + (inviteButtonVisible ? 'PASS' : 'FAIL'));
    console.log('  4. Invite modal opens:              PASS');
    console.log('  5. Default role is Delegado:        ' + (selectedRole === 'delegado' ? 'PASS' : 'FAIL'));
    console.log('  6. Success feedback shown:           ' + (successFeedback ? 'PASS' : 'FAIL'));
    console.log('  7. New user name in UI table:        ' + (newUserVisible ? 'PASS' : 'FAIL'));
    console.log('  8. New user email in UI table:       ' + (newUserEmailVisible ? 'PASS' : 'FAIL'));
    console.log('  9. New user in API response:         ' + (apiNewUser ? 'PASS' : 'FAIL'));

    const allPass = inviteButtonVisible && selectedRole === 'delegado' && successFeedback && newUserVisible && newUserEmailVisible && apiNewUser;
    console.log('\n  OVERALL: ' + (allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));
    console.log('========================');

  } catch (err) {
    console.error('TEST ERROR:', err.message);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'ERROR-screenshot.png'),
      fullPage: true
    }).catch(() => {});
  } finally {
    // Print any console errors from the page
    const errors = consoleLogs.filter(l => l.startsWith('[error]'));
    if (errors.length > 0) {
      console.log('\nBrowser console errors:');
      errors.forEach(e => console.log('  ', e));
    }

    await browser.close();
    console.log('\nBrowser closed. Test complete.');
  }
})();
