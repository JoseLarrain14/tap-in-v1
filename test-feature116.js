// Test Feature #116: User list reflects backend changes
const { chromium } = require('playwright');
const http = require('http');

const API = 'http://localhost:3001';

function apiFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

(async () => {
  console.log('=== Feature #116: User list reflects backend changes ===\n');

  // Step 1: Get API user count
  const loginRes = await apiFetch(`${API}/api/auth/login`, {
    method: 'POST',
    body: { email: 'presidente@tapin.cl', password: 'password123' }
  });
  const token = loginRes.data.token;
  console.log('✓ Logged in via API');

  const usersRes = await apiFetch(`${API}/api/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const apiUsers = usersRes.data.users;
  console.log(`✓ API returns ${apiUsers.length} users:`);
  apiUsers.forEach(u => {
    console.log(`  - ${u.name} (${u.email}) - ${u.role} - ${u.is_active ? 'Active' : 'Inactive'}`);
  });

  // Step 2: Browser test
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Login
  await page.goto('http://localhost:5174/login');
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill('presidente@tapin.cl');
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL('**/', { timeout: 10000 });
  } catch (e) {
    // Set token via localStorage fallback
    await page.evaluate(async () => {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    });
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(1500);
  }
  console.log('✓ Logged in via browser');

  // Step 3: Navigate to Configuracion
  await page.goto('http://localhost:5174/configuracion');
  await page.waitForTimeout(2500);

  // Click Usuarios tab if it exists
  const usuariosTab = page.locator('button:has-text("Usuarios"), a:has-text("Usuarios")');
  if (await usuariosTab.count() > 0) {
    await usuariosTab.first().click();
    await page.waitForTimeout(1500);
  }

  // Take screenshot
  await page.screenshot({ path: 'feat116-users-list.png', fullPage: true });
  console.log('✓ Screenshot: feat116-users-list.png');

  // Step 4: Count users in the table
  const tableRows = page.locator('table tbody tr');
  const uiUserCount = await tableRows.count();
  console.log(`\n✓ UI shows ${uiUserCount} user rows`);
  console.log(`✓ API returned ${apiUsers.length} users`);
  const countMatch = uiUserCount === apiUsers.length;
  console.log(`${countMatch ? '✓' : '✗'} Count matches: ${countMatch}`);

  // Step 5: Verify each user's data matches
  console.log('\nVerifying user data in table:');
  for (let i = 0; i < apiUsers.length && i < uiUserCount; i++) {
    const row = tableRows.nth(i);
    const rowText = await row.textContent();
    const apiUser = apiUsers[i];

    const nameFound = rowText.includes(apiUser.name);
    const emailFound = rowText.includes(apiUser.email);
    const roleMap = { delegado: 'Delegado', presidente: 'Presidente', secretaria: 'Secretaria' };
    const roleFound = rowText.includes(roleMap[apiUser.role] || apiUser.role);

    console.log(`  Row ${i + 1}: ${nameFound ? '✓' : '✗'} name "${apiUser.name}" | ${emailFound ? '✓' : '✗'} email "${apiUser.email}" | ${roleFound ? '✓' : '✗'} role "${apiUser.role}"`);
  }

  // Step 6: Invite a new user via API and verify it appears
  const TS = Date.now();
  const newEmail = `f116_test_${TS}@tapin.cl`;
  const newName = `F116 Test User ${TS}`;

  console.log(`\nInviting new user: ${newName} (${newEmail})`);
  const inviteRes = await apiFetch(`${API}/api/users/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { email: newEmail, name: newName, role: 'delegado' }
  });
  console.log(`  API response: ${inviteRes.status} - ${JSON.stringify(inviteRes.data).substring(0, 100)}`);

  if (inviteRes.status === 201 || inviteRes.status === 200) {
    console.log('✓ User invited via API');

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(2500);

    // Click Usuarios tab again after reload
    const tab2 = page.locator('button:has-text("Usuarios"), a:has-text("Usuarios")');
    if (await tab2.count() > 0) {
      await tab2.first().click();
      await page.waitForTimeout(1500);
    }

    // Count users again
    const newUiCount = await tableRows.count();
    console.log(`\nAfter invite and refresh:`);
    console.log(`  UI user count: ${newUiCount} (was ${uiUserCount})`);
    const newUserAppeared = newUiCount > uiUserCount;
    console.log(`  ${newUserAppeared ? '✓' : '✗'} New user row appeared`);

    // Check if the new user's name appears in the page
    const pageContent = await page.textContent('body');
    const nameVisible = pageContent.includes(newName);
    const emailVisible = pageContent.includes(newEmail);
    console.log(`  ${nameVisible ? '✓' : '✗'} New user name "${newName}" visible`);
    console.log(`  ${emailVisible ? '✓' : '✗'} New user email "${newEmail}" visible`);

    // Take screenshot
    await page.screenshot({ path: 'feat116-after-invite.png', fullPage: true });
    console.log('✓ Screenshot: feat116-after-invite.png');
  } else {
    console.log(`✗ Failed to invite user: ${inviteRes.status}`);
  }

  // Console errors check
  if (consoleErrors.length > 0) {
    console.log('\n⚠ Console errors:', consoleErrors.slice(0, 5));
  } else {
    console.log('\n✓ No console errors');
  }

  await browser.close();
  console.log('\n=== Feature #116 test complete ===');
})();
