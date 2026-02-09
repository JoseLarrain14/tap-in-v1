// Feature #111 Browser Verification: Category dropdown populated from database
// Uses Playwright to verify income and expense forms load categories from API

const { chromium } = require('playwright');
const http = require('http');

const FRONTEND = 'http://localhost:5175';
const BACKEND = 'http://localhost:3001';
let TOKEN = '';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND);
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
  // Login via API
  const loginRes = await apiRequest('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  TOKEN = loginRes.body.token;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set token in localStorage
  await page.goto(FRONTEND + '/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({"id":1,"email":"presidente@tapin.cl","name":"Maria Gonzalez","role":"presidente","organization_id":1}));
  }, TOKEN);

  // =============================================
  // STEP 1: Verify Income form categories
  // =============================================
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2000);

  // Click "Registrar Ingreso" button to open form
  const registerBtn = page.locator('button:has-text("Registrar"), button:has-text("Nuevo Ingreso"), button:has-text("registrar"), button:has-text("+ Nuevo")');
  if (await registerBtn.count() > 0) {
    await registerBtn.first().click();
    await page.waitForTimeout(1000);
  }

  // Check the income category dropdown
  const incomeCatSelect = page.locator('[data-testid="income-category"], select').first();
  const incomeOptions = await page.locator('[data-testid="income-category"] option, select option').allTextContents();

  process.stdout.write('=== INCOME FORM CATEGORIES ===\n');
  process.stdout.write('Options found: ' + incomeOptions.length + '\n');
  incomeOptions.forEach(opt => process.stdout.write('  - "' + opt.trim() + '"\n'));

  // Verify expected ingreso categories from DB
  const expectedIngreso = ['Cuota Mensual', 'Donacion', 'Evento', 'Otro', 'Taller'];
  const hasIngresoFromDB = expectedIngreso.some(name =>
    incomeOptions.some(opt => opt.includes(name) || opt.includes(name.replace('ó', 'o')))
  );
  process.stdout.write('Has DB categories: ' + (hasIngresoFromDB ? 'YES' : 'NO') + '\n\n');

  await page.screenshot({ path: '/c/Users/josel/CPP/feat111-income-categories.png', fullPage: false });

  // =============================================
  // STEP 2: Verify Expense form categories
  // =============================================
  await page.goto(FRONTEND + '/solicitudes');
  await page.waitForTimeout(2000);

  // Click create button
  const createBtn = page.locator('button:has-text("Nueva Solicitud"), button:has-text("Crear"), button:has-text("+ Nueva")');
  if (await createBtn.count() > 0) {
    await createBtn.first().click();
    await page.waitForTimeout(1000);
  }

  // Check the expense category dropdown
  const expenseCatOptions = await page.locator('[data-testid="pr-category"] option').allTextContents();

  process.stdout.write('=== EXPENSE FORM CATEGORIES ===\n');
  process.stdout.write('Options found: ' + expenseCatOptions.length + '\n');
  expenseCatOptions.forEach(opt => process.stdout.write('  - "' + opt.trim() + '"\n'));

  // Verify expected egreso categories from DB
  const expectedEgreso = ['Eventos', 'Infraestructura', 'Otro', 'Servicios', 'Suministros', 'Transporte'];
  const hasEgresoFromDB = expectedEgreso.some(name =>
    expenseCatOptions.some(opt => opt.includes(name))
  );
  process.stdout.write('Has DB categories: ' + (hasEgresoFromDB ? 'YES' : 'NO') + '\n\n');

  await page.screenshot({ path: '/c/Users/josel/CPP/feat111-expense-categories.png', fullPage: false });

  // =============================================
  // STEP 3: Create new category via API as Presidente
  // =============================================
  const testCatName = 'FEATURE111_TEST_CAT';
  const createRes = await apiRequest('POST', '/api/categories', { name: testCatName, type: 'egreso' });
  const newCatId = createRes.body.category ? createRes.body.category.id : createRes.body.id;
  process.stdout.write('Created test category: "' + testCatName + '" id=' + newCatId + ' status=' + createRes.status + '\n');

  // =============================================
  // STEP 4: Reopen expense form, verify new category appears
  // =============================================
  await page.goto(FRONTEND + '/solicitudes');
  await page.waitForTimeout(2000);

  const createBtn2 = page.locator('button:has-text("Nueva Solicitud"), button:has-text("Crear"), button:has-text("+ Nueva")');
  if (await createBtn2.count() > 0) {
    await createBtn2.first().click();
    await page.waitForTimeout(1000);
  }

  const expenseCatOptions2 = await page.locator('[data-testid="pr-category"] option').allTextContents();

  process.stdout.write('\n=== EXPENSE FORM AFTER ADDING CATEGORY ===\n');
  process.stdout.write('Options found: ' + expenseCatOptions2.length + '\n');
  expenseCatOptions2.forEach(opt => process.stdout.write('  - "' + opt.trim() + '"\n'));

  const foundNewCat = expenseCatOptions2.some(opt => opt.includes(testCatName));
  process.stdout.write('New category "' + testCatName + '" visible: ' + (foundNewCat ? 'YES' : 'NO') + '\n');

  await page.screenshot({ path: '/c/Users/josel/CPP/feat111-new-category-visible.png', fullPage: false });

  // =============================================
  // Cleanup
  // =============================================
  if (newCatId) {
    await apiRequest('DELETE', '/api/categories/' + newCatId);
    process.stdout.write('\nCleanup: deleted test category\n');
  }

  // =============================================
  // Summary
  // =============================================
  process.stdout.write('\n=== FEATURE #111 SUMMARY ===\n');
  process.stdout.write('1. Income form loads categories from API: ' + (hasIngresoFromDB ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('2. Expense form loads categories from API: ' + (hasEgresoFromDB ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('3. New category created as Presidente: ' + (createRes.status === 201 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('4. New category appears in dropdown: ' + (foundNewCat ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('OVERALL: ' + (hasIngresoFromDB && hasEgresoFromDB && createRes.status === 201 && foundNewCat ? 'ALL PASS' : 'SOME FAILURES') + '\n');

  await browser.close();
}

run().catch(err => {
  process.stdout.write('Error: ' + err.message + '\n');
  process.stdout.write(err.stack + '\n');
  process.exit(1);
});
