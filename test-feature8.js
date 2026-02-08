const { chromium } = require('playwright');

async function testFeature8() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push('PAGE ERROR: ' + err.message);
  });

  try {
    // Step 1: Login as Presidente
    console.log('Step 1: Login as Presidente...');
    await page.goto('http://localhost:5181/login', { timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation away from /login
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log('  Current URL:', page.url());
    console.log('  ✅ Logged in as Presidente');

    // Step 2: Verify sidebar is visible on desktop viewport
    console.log('Step 2: Verify sidebar is visible...');
    await page.waitForSelector('aside', { timeout: 5000 });
    console.log('  ✅ Sidebar is visible');

    // Step 3-8: Verify all menu items for Presidente
    const menuItems = ['Dashboard', 'Ingresos', 'Egresos', 'Reportes', 'Notificaciones', 'Configuración'];
    for (const item of menuItems) {
      const link = page.locator('nav a', { hasText: item });
      const count = await link.count();
      if (count === 0) throw new Error(`Menu item "${item}" not found`);
      if (!(await link.first().isVisible())) throw new Error(`Menu item "${item}" not visible`);
      console.log(`  ✅ ${item} menu item exists`);
    }

    await page.screenshot({ path: 'screenshots-feature8-presidente.png', fullPage: false });
    console.log('  📸 Screenshot: presidente sidebar');

    // Step 9: Verify navigation links work
    console.log('Step 9: Verify navigation links...');

    await page.locator('nav a', { hasText: 'Ingresos' }).first().click();
    await page.waitForFunction(() => window.location.pathname === '/ingresos', { timeout: 5000 });
    console.log('  ✅ Ingresos page loads');

    await page.locator('nav a', { hasText: 'Egresos' }).first().click();
    await page.waitForFunction(() => window.location.pathname === '/solicitudes', { timeout: 5000 });
    console.log('  ✅ Egresos (Solicitudes) page loads');

    await page.locator('nav a', { hasText: 'Reportes' }).first().click();
    await page.waitForFunction(() => window.location.pathname === '/reportes', { timeout: 5000 });
    console.log('  ✅ Reportes page loads');

    await page.locator('nav a', { hasText: 'Notificaciones' }).first().click();
    await page.waitForFunction(() => window.location.pathname === '/notificaciones', { timeout: 5000 });
    console.log('  ✅ Notificaciones page loads');

    await page.locator('nav a', { hasText: 'Configuración' }).first().click();
    await page.waitForFunction(() => window.location.pathname.includes('/configuracion'), { timeout: 5000 });
    console.log('  ✅ Configuración page loads');

    // Step 10: Logout, login as Delegado
    console.log('Step 10: Logout and login as Delegado...');
    await page.locator('button', { hasText: 'Cerrar sesión' }).click();
    await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 5000 });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    await page.fill('input[type="email"]', 'delegado@tapin.cl');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log('  ✅ Logged in as Delegado');

    // Step 11: Verify Configuración is NOT visible for Delegado
    console.log('Step 11: Verify Configuración NOT visible for Delegado...');
    await page.waitForSelector('aside', { timeout: 5000 });
    const configForDelegado = page.locator('nav a', { hasText: 'Configuración' });
    const configCount = await configForDelegado.count();
    if (configCount > 0) throw new Error('Configuración should NOT be visible for Delegado');
    console.log('  ✅ Configuración is NOT visible for Delegado');

    // Verify other items still exist
    const delegadoItems = ['Dashboard', 'Ingresos', 'Egresos', 'Reportes', 'Notificaciones'];
    for (const item of delegadoItems) {
      const link = page.locator('nav a', { hasText: item });
      if (!(await link.first().isVisible())) throw new Error(`${item} not visible for Delegado`);
    }
    console.log('  ✅ All other nav items visible for Delegado');

    await page.screenshot({ path: 'screenshots-feature8-delegado.png', fullPage: false });
    console.log('  📸 Screenshot: delegado sidebar');

    const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    if (realErrors.length > 0) {
      console.log('\n⚠️ Console errors:');
      realErrors.forEach(e => console.log('  -', e));
    } else {
      console.log('\n✅ No console errors');
    }

    console.log('\n🎉 ALL FEATURE #8 TESTS PASSED!');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    await page.screenshot({ path: 'screenshots-feature8-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testFeature8();
