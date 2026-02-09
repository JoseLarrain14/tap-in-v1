// Feature #112: Income list reflects backend data changes
// Verify income table is always in sync with backend data
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const FRONTEND = 'http://localhost:5175';
const BACKEND = 'http://localhost:3001';
const DIR = path.join(__dirname);
let TOKEN = '';

function apiReq(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BACKEND);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Login
  const loginRes = await apiReq('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  TOKEN = loginRes.body.token;
  process.stdout.write('Login: OK\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set auth
  await page.goto(FRONTEND + '/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({"id":1,"email":"presidente@tapin.cl","name":"Maria Gonzalez","role":"presidente","organization_id":1}));
  }, TOKEN);

  // =============================================
  // STEP 1: Create income via API
  // =============================================
  const createRes = await apiReq('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 77777,
    category_id: 1,
    description: 'F112_TEST_INCOME_CREATE',
    payer_name: 'F112 Test Payer',
    date: '2026-02-09'
  });
  const txId = createRes.body.id;
  process.stdout.write('STEP 1: Created income via API: id=' + txId + ' status=' + createRes.status + '\n');

  // =============================================
  // STEP 2: Refresh income page, verify new income appears
  // =============================================
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2500);

  // Look for the test income in the page
  const pageContent = await page.textContent('body');
  const foundAfterCreate = pageContent.includes('F112_TEST_INCOME_CREATE') || pageContent.includes('77.777') || pageContent.includes('77777');
  process.stdout.write('STEP 2: New income visible after refresh: ' + (foundAfterCreate ? 'YES' : 'NO') + '\n');

  await page.screenshot({ path: path.join(DIR, 'feat112-after-create.png') });

  // =============================================
  // STEP 3: Edit income via API
  // =============================================
  const editRes = await apiReq('PUT', '/api/transactions/' + txId, {
    amount: 88888,
    description: 'F112_EDITED_INCOME',
    payer_name: 'F112 Edited Payer',
    category_id: 2,
    date: '2026-02-09'
  });
  process.stdout.write('STEP 3: Edited income via API: status=' + editRes.status + '\n');

  // =============================================
  // STEP 4: Refresh - verify updated data shown
  // =============================================
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2500);

  const pageContent2 = await page.textContent('body');
  const foundEdited = pageContent2.includes('F112_EDITED_INCOME') || pageContent2.includes('88.888') || pageContent2.includes('88888');
  const oldGone = !pageContent2.includes('F112_TEST_INCOME_CREATE');
  process.stdout.write('STEP 4: Edited income visible: ' + (foundEdited ? 'YES' : 'NO') + '\n');
  process.stdout.write('STEP 4: Old description gone: ' + (oldGone ? 'YES' : 'NO') + '\n');

  await page.screenshot({ path: path.join(DIR, 'feat112-after-edit.png') });

  // =============================================
  // STEP 5: Delete via API - refresh - verify removed
  // =============================================
  const deleteRes = await apiReq('DELETE', '/api/transactions/' + txId);
  process.stdout.write('STEP 5: Deleted income via API: status=' + deleteRes.status + '\n');

  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2500);

  const pageContent3 = await page.textContent('body');
  const deletedGone = !pageContent3.includes('F112_EDITED_INCOME') && !pageContent3.includes('F112_TEST_INCOME_CREATE');
  process.stdout.write('STEP 5: Deleted income gone from table: ' + (deletedGone ? 'YES' : 'NO') + '\n');

  await page.screenshot({ path: path.join(DIR, 'feat112-after-delete.png') });

  // =============================================
  // Summary
  // =============================================
  process.stdout.write('\n=== FEATURE #112 SUMMARY ===\n');
  process.stdout.write('1. Create income via API: ' + (createRes.status === 201 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('2. New income appears after refresh: ' + (foundAfterCreate ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('3. Edit income via API: ' + (editRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('4. Edited data shown after refresh: ' + (foundEdited ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('5. Delete via API: ' + (deleteRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('6. Deleted income removed after refresh: ' + (deletedGone ? 'PASS' : 'FAIL') + '\n');

  const allPass = createRes.status === 201 && foundAfterCreate && editRes.status === 200 && foundEdited && deleteRes.status === 200 && deletedGone;
  process.stdout.write('OVERALL: ' + (allPass ? 'ALL PASS' : 'SOME FAILURES') + '\n');

  await browser.close();
}

run().catch(err => {
  process.stdout.write('Error: ' + err.message + '\n' + err.stack + '\n');
  process.exit(1);
});
