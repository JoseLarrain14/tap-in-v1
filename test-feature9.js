const { chromium } = require('playwright');

async function testFeature9() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  try {
    // Login first
    console.log('Step 0: Login...');
    await page.goto('http://localhost:5181/login', { timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 5000 });

    // Clear any previously stored sidebar state
    await page.evaluate(() => localStorage.removeItem('sidebar_collapsed'));
    await page.reload();
    await page.waitForSelector('aside', { timeout: 5000 });
    console.log('  ✅ Logged in and reset sidebar state');

    // Step 1: Verify sidebar is expanded by default
    console.log('Step 1: Verify sidebar is expanded by default...');
    const sidebar = page.locator('[data-testid="sidebar"]');
    let collapsedState = await sidebar.getAttribute('data-collapsed');
    console.log('  data-collapsed:', collapsedState);
    if (collapsedState !== 'false') throw new Error('Sidebar should be expanded by default');

    // Verify sidebar has wide width (w-64 = 256px)
    let sidebarBox = await sidebar.boundingBox();
    console.log('  Sidebar width:', sidebarBox.width);
    if (sidebarBox.width < 200) throw new Error('Sidebar should be wide (expanded)');
    console.log('  ✅ Sidebar is expanded by default (width:', sidebarBox.width + 'px)');

    // Verify labels are visible
    const dashboardLabel = page.locator('nav a', { hasText: 'Dashboard' });
    const labelText = await dashboardLabel.first().textContent();
    console.log('  Dashboard nav text:', JSON.stringify(labelText.trim()));
    if (!labelText.includes('Dashboard')) throw new Error('Dashboard label not visible when expanded');
    console.log('  ✅ Labels are visible when expanded');

    await page.screenshot({ path: 'screenshots-feature9-expanded.png', fullPage: false });

    // Step 2: Click the collapse toggle button
    console.log('Step 2: Click collapse toggle...');
    const toggleBtn = page.locator('[data-testid="sidebar-toggle"]');
    await toggleBtn.click();
    await page.waitForTimeout(500); // Wait for transition

    // Step 3: Verify sidebar collapses (narrower, icons only)
    console.log('Step 3: Verify sidebar is collapsed...');
    collapsedState = await sidebar.getAttribute('data-collapsed');
    console.log('  data-collapsed:', collapsedState);
    if (collapsedState !== 'true') throw new Error('Sidebar should be collapsed after click');

    sidebarBox = await sidebar.boundingBox();
    console.log('  Sidebar width:', sidebarBox.width);
    if (sidebarBox.width > 100) throw new Error('Sidebar should be narrow (collapsed), got ' + sidebarBox.width + 'px');
    console.log('  ✅ Sidebar is collapsed (width:', sidebarBox.width + 'px)');

    await page.screenshot({ path: 'screenshots-feature9-collapsed.png', fullPage: false });

    // Step 4: Refresh the page
    console.log('Step 4: Refresh the page...');
    await page.reload();
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Step 5: Verify sidebar remains collapsed after refresh
    console.log('Step 5: Verify sidebar remains collapsed after refresh...');
    collapsedState = await sidebar.getAttribute('data-collapsed');
    console.log('  data-collapsed:', collapsedState);
    if (collapsedState !== 'true') throw new Error('Sidebar should remain collapsed after refresh');

    sidebarBox = await sidebar.boundingBox();
    console.log('  Sidebar width:', sidebarBox.width);
    if (sidebarBox.width > 100) throw new Error('Sidebar should remain narrow after refresh');
    console.log('  ✅ Sidebar remains collapsed after refresh (width:', sidebarBox.width + 'px)');

    // Step 6: Click toggle again to expand
    console.log('Step 6: Click toggle to expand...');
    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Step 7: Verify sidebar expands back
    console.log('Step 7: Verify sidebar expands back...');
    collapsedState = await sidebar.getAttribute('data-collapsed');
    console.log('  data-collapsed:', collapsedState);
    if (collapsedState !== 'false') throw new Error('Sidebar should be expanded after toggle');

    sidebarBox = await sidebar.boundingBox();
    console.log('  Sidebar width:', sidebarBox.width);
    if (sidebarBox.width < 200) throw new Error('Sidebar should be wide (expanded)');
    console.log('  ✅ Sidebar expanded back (width:', sidebarBox.width + 'px)');

    await page.screenshot({ path: 'screenshots-feature9-re-expanded.png', fullPage: false });

    // Step 8: Refresh page — verify it stays expanded
    console.log('Step 8: Refresh and verify stays expanded...');
    await page.reload();
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    collapsedState = await sidebar.getAttribute('data-collapsed');
    console.log('  data-collapsed:', collapsedState);
    if (collapsedState !== 'false') throw new Error('Sidebar should remain expanded after refresh');

    sidebarBox = await sidebar.boundingBox();
    console.log('  Sidebar width:', sidebarBox.width);
    if (sidebarBox.width < 200) throw new Error('Sidebar should remain wide after refresh');
    console.log('  ✅ Sidebar remains expanded after refresh');

    // Final cleanup: ensure localStorage persisted properly
    const lsValue = await page.evaluate(() => localStorage.getItem('sidebar_collapsed'));
    console.log('  localStorage sidebar_collapsed:', lsValue);

    const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    if (realErrors.length > 0) {
      console.log('\n⚠️ Console errors:');
      realErrors.forEach(e => console.log('  -', e));
    } else {
      console.log('\n✅ No console errors');
    }

    console.log('\n🎉 ALL FEATURE #9 TESTS PASSED!');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    await page.screenshot({ path: 'screenshots-feature9-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testFeature9();
