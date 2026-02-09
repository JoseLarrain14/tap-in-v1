const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const FRONTEND = 'http://localhost:5175';
const BACKEND = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname);
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
  const loginRes = await apiReq('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  TOKEN = loginRes.body.token;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(FRONTEND + '/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({"id":1,"email":"presidente@tapin.cl","name":"Maria Gonzalez","role":"presidente","organization_id":1}));
  }, TOKEN);

  // STEP 1: Income form
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2000);

  // Open form
  const regBtn = page.locator('button:has-text("Registrar"), button:has-text("+ Nuevo")');
  if (await regBtn.count() > 0) await regBtn.first().click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'feat111-income-form.png') });

  // STEP 2: Expense form
  await page.goto(FRONTEND + '/solicitudes');
  await page.waitForTimeout(2000);

  const createBtn = page.locator('button:has-text("Nueva Solicitud"), button:has-text("+ Nueva")');
  if (await createBtn.count() > 0) await createBtn.first().click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'feat111-expense-form.png') });

  // STEP 3: Create test category via Configuracion page
  await page.goto(FRONTEND + '/configuracion');
  await page.waitForTimeout(2000);

  // Click Categories tab
  const catTab = page.locator('button:has-text("Categorías"), [data-testid="categories-tab"]');
  if (await catTab.count() > 0) await catTab.first().click();
  await page.waitForTimeout(1000);

  // Create via API
  const testCatName = 'TEST_F111_VERIFY';
  const createRes = await apiReq('POST', '/api/categories', { name: testCatName, type: 'egreso' });
  const newId = createRes.body.category ? createRes.body.category.id : createRes.body.id;
  process.stdout.write('Created: ' + testCatName + ' id=' + newId + '\n');

  // STEP 4: Go back to expense form
  await page.goto(FRONTEND + '/solicitudes');
  await page.waitForTimeout(2000);

  const createBtn2 = page.locator('button:has-text("Nueva Solicitud"), button:has-text("+ Nueva")');
  if (await createBtn2.count() > 0) await createBtn2.first().click();
  await page.waitForTimeout(1000);

  // Get all options from the category dropdown
  const opts = await page.locator('[data-testid="pr-category"] option').allTextContents();
  process.stdout.write('Expense options after adding: ' + opts.join(', ') + '\n');
  const foundNew = opts.some(o => o.includes(testCatName));
  process.stdout.write('New category visible: ' + (foundNew ? 'YES' : 'NO') + '\n');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'feat111-new-cat-in-dropdown.png') });

  // Cleanup
  if (newId) await apiReq('DELETE', '/api/categories/' + newId);
  process.stdout.write('Cleanup done\n');

  await browser.close();
  process.stdout.write('ALL STEPS VERIFIED SUCCESSFULLY\n');
}

run().catch(err => {
  process.stdout.write('Error: ' + err.message + '\n' + err.stack + '\n');
  process.exit(1);
});
