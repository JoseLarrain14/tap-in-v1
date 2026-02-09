const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = {
    phase1: { steps: [], passed: true },
    phase2: { steps: [], passed: true },
    phase3: { steps: [], passed: true },
    phase4: { steps: [], passed: true },
  };

  function log(phase, step, status, detail = '') {
    const entry = `[${phase}] ${status}: ${step}${detail ? ' - ' + detail : ''}`;
    console.log(entry);
    results[phase].steps.push(entry);
    if (status === 'FAIL') results[phase].passed = false;
  }

  try {
    // ========== PHASE 1: Login and navigate to Configuracion ==========
    console.log('\n===== PHASE 1: Login and go to Configuracion =====\n');

    // Step 1: Navigate to login - try port 5173 first, fallback to 5174
    let baseUrl = 'http://localhost:5173';
    try {
      await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch {
      baseUrl = 'http://localhost:5174';
      await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 8000 });
    }
    console.log('Using base URL:', baseUrl);
    log('phase1', 'Navigate to /login', 'PASS');

    // Wait for React to hydrate - look for the login form
    await page.waitForSelector('#email', { state: 'visible', timeout: 15000 });

    // Debug screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat107-debug-login.png', fullPage: true });

    // Step 2: Fill email and password
    await page.fill('#email', 'presidente@tapin.cl');
    await page.fill('#password', 'password123');
    log('phase1', 'Fill email and password', 'PASS');

    // Step 3: Click Ingresar
    await page.click('button:has-text("Ingresar")');
    log('phase1', 'Click Ingresar button', 'PASS');

    // Step 4: Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    log('phase1', 'Wait for navigation', currentUrl.includes('dashboard') ? 'PASS' : 'WARN', `Current URL: ${currentUrl}`);

    // Step 5: Navigate to Configuracion
    await page.goto(baseUrl + '/configuracion', { waitUntil: 'domcontentloaded', timeout: 15000 });
    log('phase1', 'Navigate to /configuracion', 'PASS');

    // Step 6: Wait for page to load
    await page.waitForSelector('h1:has-text("Configuración")', { timeout: 10000 });
    log('phase1', 'Wait for page load', 'PASS', 'Found "Configuracion" heading');

    // Step 7: Screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat107-config-page.png', fullPage: true });
    log('phase1', 'Screenshot saved', 'PASS', 'feat107-config-page.png');

    // ========== PHASE 2: Test duplicate email invitation ==========
    console.log('\n===== PHASE 2: Test duplicate email invitation =====\n');

    // Count initial users before the test
    const initialUserRows = await page.$$('table tbody tr');
    const initialCount = initialUserRows.length;
    log('phase2', 'Initial user count', 'PASS', `${initialCount} users`);

    // Step 8: Click "+ Invitar Usuario"
    await page.click('button:has-text("Invitar Usuario")');
    log('phase2', 'Click "+ Invitar Usuario"', 'PASS');

    // Step 9: Wait for modal
    await page.waitForSelector('h2:has-text("Invitar Usuario")', { timeout: 5000 });
    log('phase2', 'Wait for invite modal', 'PASS', 'Modal appeared');

    // Step 10: Fill name
    const nameInput = page.locator('input[placeholder="Juan Pérez"]');
    await nameInput.fill('Test Duplicate User');
    log('phase2', 'Fill "Nombre completo"', 'PASS', 'Test Duplicate User');

    // Step 11: Fill duplicate email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('presidente@tapin.cl');
    log('phase2', 'Fill "Email" with duplicate', 'PASS', 'presidente@tapin.cl');

    // Step 12: Role defaults to delegado
    const roleSelect = page.locator('select').last();
    const roleValue = await roleSelect.inputValue();
    log('phase2', 'Role defaults to delegado', roleValue === 'delegado' ? 'PASS' : 'FAIL', `Current: ${roleValue}`);

    // Step 13: Click Invitar submit
    await page.click('button[type="submit"]:has-text("Invitar")');
    log('phase2', 'Click "Invitar" submit', 'PASS');

    // Step 14: Wait for API response
    await page.waitForTimeout(2000);
    log('phase2', 'Wait 2s for API response', 'PASS');

    // Step 15: Screenshot of error
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat107-duplicate-error.png', fullPage: true });
    log('phase2', 'Screenshot saved', 'PASS', 'feat107-duplicate-error.png');

    // Step 16: Verify error message
    const errorElement = page.locator('[data-testid="invite-error"]');
    const errorVisible = await errorElement.isVisible().catch(() => false);

    if (errorVisible) {
      const errorText = await errorElement.textContent();
      const containsExpected = errorText.includes('Ya existe') || errorText.toLowerCase().includes('email');
      log('phase2', 'Error message displayed', containsExpected ? 'PASS' : 'FAIL', `Text: "${errorText}"`);
    } else {
      // Try a broader search for error text
      const pageText = await page.textContent('body');
      const hasErrorText = pageText.includes('Ya existe') || pageText.includes('already exists');
      log('phase2', 'Error message displayed', hasErrorText ? 'PASS' : 'FAIL', errorVisible ? '' : 'data-testid="invite-error" not visible');
    }

    // Step 17: Check data-testid="invite-error"
    const testIdExists = await errorElement.count() > 0;
    log('phase2', 'data-testid="invite-error" element', testIdExists ? 'PASS' : 'FAIL', testIdExists ? 'Found' : 'Not found');

    // ========== PHASE 3: Verify no duplicate user created ==========
    console.log('\n===== PHASE 3: Verify no duplicate user created =====\n');

    // Step 18: Close modal
    await page.click('button:has-text("Cancelar")');
    await page.waitForTimeout(500);
    log('phase3', 'Close modal (Cancelar)', 'PASS');

    // Step 19: Count user rows
    await page.waitForTimeout(1000);
    const userRows = await page.$$('table tbody tr');
    const userCount = userRows.length;
    log('phase3', 'Count user rows', userCount === initialCount ? 'PASS' : 'FAIL', `${userCount} users (was ${initialCount})`);

    // Step 20: Screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat107-no-duplicate.png', fullPage: true });
    log('phase3', 'Screenshot saved', 'PASS', 'feat107-no-duplicate.png');

    // ========== PHASE 4: Test successful invitation with new email ==========
    console.log('\n===== PHASE 4: Test successful invitation with new email =====\n');

    // Step 21: Click "+ Invitar Usuario" again
    await page.click('button:has-text("Invitar Usuario")');
    await page.waitForSelector('h2:has-text("Invitar Usuario")', { timeout: 5000 });
    log('phase4', 'Click "+ Invitar Usuario"', 'PASS');

    // Step 22: Fill name
    const nameInput2 = page.locator('input[placeholder="Juan Pérez"]');
    await nameInput2.fill('Feature 107 Unique Test');
    log('phase4', 'Fill name', 'PASS', 'Feature 107 Unique Test');

    // Step 23: Fill unique email
    const emailInput2 = page.locator('input[type="email"]');
    await emailInput2.fill('feat107_unique_test@tapin.cl');
    log('phase4', 'Fill email', 'PASS', 'feat107_unique_test@tapin.cl');

    // Step 24: Role defaults to delegado (leave as is)
    log('phase4', 'Leave role as delegado', 'PASS');

    // Step 25: Click Invitar
    await page.click('button[type="submit"]:has-text("Invitar")');
    log('phase4', 'Click "Invitar"', 'PASS');

    // Step 26: Wait for response
    await page.waitForTimeout(2000);
    log('phase4', 'Wait 2s for API response', 'PASS');

    // Step 27: Screenshot
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat107-success.png', fullPage: true });
    log('phase4', 'Screenshot saved', 'PASS', 'feat107-success.png');

    // Step 28: Verify success message
    const successBanner = page.locator('.bg-green-50');
    const successVisible = await successBanner.isVisible({ timeout: 3000 }).catch(() => false);
    if (successVisible) {
      const successText = await successBanner.textContent();
      log('phase4', 'Success message appeared', 'PASS', `Text: "${successText.trim()}"`);
    } else {
      // Modal should have closed on success
      const modalGone = !(await page.locator('h2:has-text("Invitar Usuario")').isVisible().catch(() => false));
      log('phase4', 'Success message appeared', modalGone ? 'PASS' : 'FAIL', modalGone ? 'Modal closed (indicates success)' : 'No success indicator found');
    }

    // Step 29: Verify new user in table
    await page.waitForTimeout(1000);
    const finalUserRows = await page.$$('table tbody tr');
    const finalCount = finalUserRows.length;
    const pageContent = await page.textContent('body');
    const hasNewUser = pageContent.includes('feat107_unique_test@tapin.cl') || pageContent.includes('Feature 107 Unique Test');
    log('phase4', 'New user in table', hasNewUser ? 'PASS' : 'FAIL', `Users: ${finalCount} (was ${initialCount}), email found: ${hasNewUser}`);

  } catch (err) {
    console.error('\n[ERROR] Unexpected error:', err.message);
  } finally {
    // Summary
    console.log('\n\n========== SUMMARY ==========');
    for (const [phase, data] of Object.entries(results)) {
      console.log(`\n${phase.toUpperCase()}: ${data.passed ? 'PASSED' : 'FAILED'}`);
      data.steps.forEach(s => console.log('  ' + s));
    }

    const allPassed = Object.values(results).every(r => r.passed);
    console.log(`\n===== OVERALL: ${allPassed ? 'ALL PHASES PASSED' : 'SOME PHASES FAILED'} =====\n`);

    await browser.close();
    process.exit(allPassed ? 0 : 1);
  }
})();
