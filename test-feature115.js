// Test Feature #115: Payment request state transitions update UI immediately
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // Login as presidente
  await page.goto('http://localhost:5174/login');
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'presidente@tapin.cl');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('✓ Logged in as presidente, URL:', page.url());

  // Navigate to solicitudes
  await page.goto('http://localhost:5174/solicitudes');
  await page.waitForTimeout(2000);

  // Make sure kanban view is active
  await page.click('[data-testid="view-kanban"]');
  await page.waitForTimeout(1500);

  // Get initial counts
  const getColumnCount = async (status) => {
    const col = page.locator(`[data-testid="kanban-column-${status}"]`);
    const badge = col.locator('.rounded-full');
    const text = await badge.textContent();
    return parseInt(text.trim());
  };

  const pendienteBefore = await getColumnCount('pendiente');
  const aprobadoBefore = await getColumnCount('aprobado');
  console.log(`\nBefore approval:`);
  console.log(`  Pendiente: ${pendienteBefore}`);
  console.log(`  Aprobado: ${aprobadoBefore}`);

  // Take screenshot before
  await page.screenshot({ path: 'feat115-before-approve.png', fullPage: false });
  console.log('✓ Screenshot: feat115-before-approve.png');

  // Find and click the first approve button (✓) on a pendiente card
  const approveBtn = page.locator('[data-testid="kanban-column-pendiente"] button').first();
  const approveExists = await approveBtn.count();
  if (approveExists > 0) {
    // Check we don't have a navigation event (no full page reload)
    let navigationHappened = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigationHappened = true;
    });

    await approveBtn.click();

    // Wait for the optimistic update (should be immediate)
    await page.waitForTimeout(800);

    // Take screenshot during/after transition
    await page.screenshot({ path: 'feat115-after-approve.png', fullPage: false });
    console.log('✓ Screenshot: feat115-after-approve.png');

    // Get counts after
    const pendienteAfter = await getColumnCount('pendiente');
    const aprobadoAfter = await getColumnCount('aprobado');
    console.log(`\nAfter approval:`);
    console.log(`  Pendiente: ${pendienteAfter} (was ${pendienteBefore})`);
    console.log(`  Aprobado: ${aprobadoAfter} (was ${aprobadoBefore})`);

    // Verify
    const pendienteDecreased = pendienteAfter < pendienteBefore;
    const aprobadoIncreased = aprobadoAfter > aprobadoBefore;

    console.log(`\nVerification:`);
    console.log(`  ${pendienteDecreased ? '✓' : '✗'} Pendiente count decreased`);
    console.log(`  ${aprobadoIncreased ? '✓' : '✗'} Aprobado count increased`);
    console.log(`  ${!navigationHappened ? '✓' : '✗'} No full page navigation (SPA update)`);

    // Check for animated cards
    const animatedCards = await page.locator('.animate-card-enter').count();
    console.log(`  ${animatedCards > 0 ? '✓' : '⚠'} Animated cards found: ${animatedCards}`);

    // Wait for background sync to complete
    await page.waitForTimeout(2000);

    // Final check after sync
    const pendienteFinal = await getColumnCount('pendiente');
    const aprobadoFinal = await getColumnCount('aprobado');
    console.log(`\nAfter background sync:`);
    console.log(`  Pendiente: ${pendienteFinal}`);
    console.log(`  Aprobado: ${aprobadoFinal}`);

    // Take final screenshot
    await page.screenshot({ path: 'feat115-final-state.png', fullPage: false });
    console.log('✓ Screenshot: feat115-final-state.png');

    // Check for feedback message
    const feedbackEl = page.locator('.bg-green-50');
    const hasFeedback = await feedbackEl.count();
    console.log(`  ${hasFeedback > 0 ? '✓' : '✗'} Success feedback message shown`);

  } else {
    console.log('✗ No approve button found on pendiente cards');
  }

  // Check console errors
  const errors = consoleMessages.filter(m => m.type === 'error');
  if (errors.length > 0) {
    console.log('\n⚠ Console errors:', errors.map(e => e.text).join(', '));
  } else {
    console.log('\n✓ No console errors');
  }

  await browser.close();
  console.log('\n=== Feature #115 test complete ===');
})();
