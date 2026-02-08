const { chromium } = require('playwright');

async function testFeature16() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  let delegadoToken = '';

  try {
    // Step 1: Login as Delegado
    console.log('Step 1: Login as Delegado...');
    await page.goto('http://localhost:5181/login', { timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'delegado@tapin.cl');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 5000 });
    console.log('  ✅ Logged in as Delegado');

    // Get token for API tests
    delegadoToken = await page.evaluate(() => localStorage.getItem('token'));
    console.log('  Token obtained:', delegadoToken ? 'yes' : 'no');

    // Step 2: Verify Configuración is NOT in sidebar navigation
    console.log('Step 2: Verify Configuración NOT in sidebar...');
    const configLink = page.locator('nav a', { hasText: 'Configuración' });
    const configCount = await configLink.count();
    if (configCount > 0) throw new Error('Configuración should NOT be in sidebar for Delegado');
    console.log('  ✅ Configuración is NOT in sidebar navigation');

    await page.screenshot({ path: 'screenshots-feature16-no-config.png', fullPage: false });

    // Step 3: Navigate directly to /configuracion
    console.log('Step 3: Navigate directly to /configuracion...');
    await page.goto('http://localhost:5181/configuracion', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Step 4: Verify access is denied (redirect to dashboard)
    console.log('Step 4: Verify access denied (redirect to dashboard)...');
    const currentPath = await page.evaluate(() => window.location.pathname);
    console.log('  Current path after /configuracion:', currentPath);
    if (currentPath.includes('/configuracion')) {
      throw new Error('Delegado should be redirected away from /configuracion, but is still on: ' + currentPath);
    }
    if (currentPath !== '/') {
      console.log('  Warning: redirected to', currentPath, 'instead of /');
    }
    console.log('  ✅ Access denied - redirected to:', currentPath);

    await page.screenshot({ path: 'screenshots-feature16-redirected.png', fullPage: false });

    // Step 5: Try calling PUT /api/users/:id/role with Delegado token
    console.log('Step 5: Test PUT /api/users/:id/role with Delegado token...');
    const apiResponse = await page.evaluate(async (token) => {
      const resp = await fetch('/api/users/2/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ role: 'presidente' })
      });
      return {
        status: resp.status,
        data: await resp.json()
      };
    }, delegadoToken);

    console.log('  API Response status:', apiResponse.status);
    console.log('  API Response data:', JSON.stringify(apiResponse.data));

    // Step 6: Verify 403 Forbidden response
    console.log('Step 6: Verify 403 Forbidden response...');
    if (apiResponse.status !== 403) {
      throw new Error('Expected 403 Forbidden but got ' + apiResponse.status);
    }
    console.log('  ✅ Got 403 Forbidden response');

    // Additional: test POST /api/users/invite as delegado
    console.log('  Additional: Test POST /api/users/invite...');
    const inviteResponse = await page.evaluate(async (token) => {
      const resp = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ email: 'test@test.cl', name: 'Test', role: 'delegado' })
      });
      return { status: resp.status, data: await resp.json() };
    }, delegadoToken);

    console.log('  Invite Response status:', inviteResponse.status);
    if (inviteResponse.status !== 403) {
      throw new Error('Expected 403 for invite but got ' + inviteResponse.status);
    }
    console.log('  ✅ POST /api/users/invite also returns 403');

    // Additional: test without any auth token (401)
    console.log('  Additional: Test without auth token...');
    const noAuthResponse = await page.evaluate(async () => {
      const resp = await fetch('/api/users/2/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'presidente' })
      });
      return { status: resp.status };
    });

    console.log('  No auth Response status:', noAuthResponse.status);
    if (noAuthResponse.status !== 401) {
      throw new Error('Expected 401 Unauthorized but got ' + noAuthResponse.status);
    }
    console.log('  ✅ Unauthenticated access returns 401');

    // Verify as Presidente it works (cross-check)
    console.log('\n  Cross-check: Verify Presidente CAN access /configuracion...');
    await page.locator('button', { hasText: 'Cerrar sesión' }).click();
    await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 5000 });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await page.fill('input[type="email"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 5000 });

    // Navigate to configuracion
    await page.goto('http://localhost:5181/configuracion');
    await page.waitForTimeout(1000);
    const presidentePath = await page.evaluate(() => window.location.pathname);
    console.log('  Presidente on /configuracion path:', presidentePath);
    if (!presidentePath.includes('/configuracion')) {
      throw new Error('Presidente should be able to access /configuracion');
    }
    console.log('  ✅ Presidente CAN access /configuracion');

    await page.screenshot({ path: 'screenshots-feature16-presidente-config.png', fullPage: false });

    const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    if (realErrors.length > 0) {
      console.log('\n⚠️ Console errors:');
      realErrors.forEach(e => console.log('  -', e));
    } else {
      console.log('\n✅ No console errors');
    }

    console.log('\n🎉 ALL FEATURE #16 TESTS PASSED!');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    await page.screenshot({ path: 'screenshots-feature16-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testFeature16();
