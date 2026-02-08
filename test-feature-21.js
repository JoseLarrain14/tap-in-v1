const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5180';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-feature21');

async function run() {
  // Create screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [PAGE ERROR]', msg.text());
  });

  try {
    // ============================================================
    // STEP 1: Navigate to login page
    // ============================================================
    console.log('\n=== STEP 1: Navigate to login page ===');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Wait for the React app to render
    await page.waitForSelector('#email', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });
    console.log('Screenshot: 01-login-page.png');
    const pageTitle = await page.textContent('h1');
    console.log('Page title:', pageTitle);

    // ============================================================
    // STEP 2: Login as secretaria
    // ============================================================
    console.log('\n=== STEP 2: Login as secretaria@tapin.cl ===');
    await page.fill('#email', 'secretaria@tapin.cl');
    await page.fill('#password', 'password123');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-login-filled.png'), fullPage: true });
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL('**/', { timeout: 15000 });
    // Wait for the dashboard/layout to render
    await page.waitForSelector('nav, aside, [class*="sidebar"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-secretaria-dashboard.png'), fullPage: true });
    console.log('Screenshot: 03-secretaria-dashboard.png');
    console.log('Current URL after login:', page.url());

    // ============================================================
    // STEP 3: Navigate to solicitudes page
    // ============================================================
    console.log('\n=== STEP 3: Navigate to solicitudes ===');
    await page.goto(`${BASE_URL}/solicitudes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-secretaria-solicitudes.png'), fullPage: true });
    console.log('Screenshot: 04-secretaria-solicitudes.png');

    // ============================================================
    // STEP 4: Create a payment request if none exist
    // ============================================================
    console.log('\n=== STEP 4: Ensure pending payment request exists ===');

    // Check if there are any pending requests
    const hasPending = await page.locator('text=Pendiente').count() > 0;
    console.log('Existing pending requests:', hasPending);

    if (!hasPending) {
      console.log('Creating a test payment request...');
      const createBtnExists = await page.locator('button:has-text("Nueva Solicitud")').count() > 0;
      if (createBtnExists) {
        await page.click('button:has-text("Nueva Solicitud")');
        await page.waitForTimeout(500);

        await page.fill('input[type="number"]', '50000');
        // Use more flexible selectors
        const descInput = page.locator('input[placeholder*="materiales"]');
        if (await descInput.count() > 0) {
          await descInput.fill('Test payment for Feature 21');
        }
        const beneInput = page.locator('input[placeholder*="Proveedor"]');
        if (await beneInput.count() > 0) {
          await beneInput.fill('Test Beneficiary');
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b-create-form.png'), fullPage: true });
        await page.click('button:has-text("Crear Solicitud")');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04c-after-create.png'), fullPage: true });
        console.log('Payment request created');
      } else {
        console.log('No "Nueva Solicitud" button found');
      }
    }

    // Reload solicitudes page
    await page.goto(`${BASE_URL}/solicitudes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // ============================================================
    // STEP 5: Filter to pending and check buttons as secretaria
    // ============================================================
    console.log('\n=== STEP 5: Filter to Pendiente and check buttons as secretaria ===');

    const pendienteBtn = page.locator('button:has-text("Pendiente")');
    if (await pendienteBtn.count() > 0) {
      await pendienteBtn.first().click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-secretaria-pendientes.png'), fullPage: true });
    console.log('Screenshot: 05-secretaria-pendientes.png');

    // Count buttons
    const aprobarInList = await page.locator('button:has-text("Aprobar")').count();
    const rechazarInList = await page.locator('button:has-text("Rechazar")').count();
    const ejecutarInList = await page.locator('button:has-text("Ejecutar")').count();

    console.log(`\nSecretaria - list view buttons:`);
    console.log(`  Aprobar buttons: ${aprobarInList}`);
    console.log(`  Rechazar buttons: ${rechazarInList}`);
    console.log(`  Ejecutar buttons: ${ejecutarInList}`);

    // ============================================================
    // STEP 6: Click on a pending request to check detail modal
    // ============================================================
    console.log('\n=== STEP 6: Open detail modal as secretaria ===');
    const tableRow = page.locator('table tbody tr').first();
    if (await tableRow.count() > 0) {
      await tableRow.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-secretaria-detail-modal.png'), fullPage: true });
      console.log('Screenshot: 06-secretaria-detail-modal.png');

      const modalAprobar = await page.locator('button:has-text("Aprobar Solicitud")').count();
      const modalRechazar = await page.locator('button:has-text("Rechazar Solicitud")').count();
      const infoMsg = await page.locator('text=Solo el Presidente puede aprobar').count();

      console.log(`Detail modal buttons:`);
      console.log(`  "Aprobar Solicitud" buttons: ${modalAprobar}`);
      console.log(`  "Rechazar Solicitud" buttons: ${modalRechazar}`);
      console.log(`  Info message present: ${infoMsg > 0}`);

      if (modalAprobar === 0 && modalRechazar === 0) {
        console.log('  => PASS: No approve/reject buttons in modal for secretaria');
      } else {
        console.log('  => FAIL: Approve/reject buttons found in modal for secretaria!');
      }

      // Close modal
      await page.locator('.fixed button:has-text("\\u00d7")').click().catch(() => {
        // Try keyboard escape
        return page.keyboard.press('Escape');
      });
      await page.waitForTimeout(300);
    } else {
      console.log('No table rows found to click');
    }

    // ============================================================
    // STEP 7: Logout from secretaria
    // ============================================================
    console.log('\n=== STEP 7: Logout ===');
    // Clear local storage directly to logout
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-logged-out.png'), fullPage: true });
    console.log('Screenshot: 07-logged-out.png');

    // ============================================================
    // STEP 8: Login as presidente
    // ============================================================
    console.log('\n=== STEP 8: Login as presidente@tapin.cl ===');
    await page.fill('#email', 'presidente@tapin.cl');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-presidente-dashboard.png'), fullPage: true });
    console.log('Screenshot: 08-presidente-dashboard.png');

    // ============================================================
    // STEP 9: Navigate to solicitudes as presidente
    // ============================================================
    console.log('\n=== STEP 9: Navigate to solicitudes as presidente ===');
    await page.goto(`${BASE_URL}/solicitudes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click Pendiente filter
    const pendienteBtn2 = page.locator('button:has-text("Pendiente")');
    if (await pendienteBtn2.count() > 0) {
      await pendienteBtn2.first().click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-presidente-solicitudes-pendientes.png'), fullPage: true });
    console.log('Screenshot: 09-presidente-solicitudes-pendientes.png');

    const presAprobar = await page.locator('button:has-text("Aprobar")').count();
    const presRechazar = await page.locator('button:has-text("Rechazar")').count();

    console.log(`\nPresidente - list view buttons:`);
    console.log(`  Aprobar buttons: ${presAprobar}`);
    console.log(`  Rechazar buttons: ${presRechazar}`);

    // ============================================================
    // STEP 10: Open detail modal as presidente
    // ============================================================
    console.log('\n=== STEP 10: Open detail modal as presidente ===');
    const presRow = page.locator('table tbody tr').first();
    if (await presRow.count() > 0) {
      await presRow.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-presidente-detail-modal.png'), fullPage: true });
      console.log('Screenshot: 10-presidente-detail-modal.png');

      const presModalAprobar = await page.locator('button:has-text("Aprobar Solicitud")').count();
      const presModalRechazar = await page.locator('button:has-text("Rechazar Solicitud")').count();

      console.log(`Detail modal buttons:`);
      console.log(`  "Aprobar Solicitud" buttons: ${presModalAprobar}`);
      console.log(`  "Rechazar Solicitud" buttons: ${presModalRechazar}`);

      if (presModalAprobar > 0 && presModalRechazar > 0) {
        console.log('  => PASS: Approve/reject buttons visible in modal for presidente');
      } else {
        console.log('  => FAIL: Missing approve/reject buttons in modal for presidente!');
      }
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    console.log('\n========================================');
    console.log('   FEATURE #21 TEST RESULTS SUMMARY');
    console.log('========================================');
    console.log('');
    console.log('Test: Secretaria cannot approve/reject payment requests');
    console.log('');

    const secListPass = aprobarInList === 0 && rechazarInList === 0;
    const presListPass = presAprobar > 0 && presRechazar > 0;

    console.log('1. Secretaria - List View:');
    console.log(`   Aprobar buttons: ${aprobarInList} (expected 0) => ${aprobarInList === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`   Rechazar buttons: ${rechazarInList} (expected 0) => ${rechazarInList === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`   Result: ${secListPass ? 'PASS' : 'FAIL'}`);
    console.log('');
    console.log('2. Presidente - List View (control test):');
    console.log(`   Aprobar buttons: ${presAprobar} (expected >= 1) => ${presAprobar > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`   Rechazar buttons: ${presRechazar} (expected >= 1) => ${presRechazar > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`   Result: ${presListPass ? 'PASS' : 'FAIL'}`);
    console.log('');

    const overallPass = secListPass && presListPass;
    console.log(`OVERALL RESULT: ${overallPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED'}`);
    console.log('========================================');

  } catch (err) {
    console.error('Test error:', err.message);
    console.error('Stack:', err.stack);
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
      console.log('Error screenshot saved');
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

run();
