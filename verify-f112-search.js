// Feature #112 search-based verification
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const FRONTEND = 'http://localhost:5175';
const BACKEND = 'http://localhost:3001';
const DIR = __dirname;
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

  // Create income via API
  const createRes = await apiReq('POST', '/api/transactions', {
    type: 'ingreso', amount: 99123, category_id: 1,
    description: 'F112_VERIFY_SEARCH', payer_name: 'F112 Search Payer', date: '2026-02-09'
  });
  const txId = createRes.body.id;
  process.stdout.write('Created: id=' + txId + '\n');

  // Navigate to ingresos and search for the test income
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2000);

  // Search for the test income
  const searchBox = page.locator('input[placeholder*="Buscar"]');
  await searchBox.fill('F112_VERIFY_SEARCH');

  // Click search button
  const searchBtn = page.locator('button:has-text("Buscar")');
  await searchBtn.click();
  await page.waitForTimeout(2000);

  const content = await page.textContent('body');
  const found = content.includes('F112_VERIFY_SEARCH');
  process.stdout.write('Found after search: ' + (found ? 'YES' : 'NO') + '\n');
  await page.screenshot({ path: path.join(DIR, 'feat112-search-found.png') });

  // Edit via API
  await apiReq('PUT', '/api/transactions/' + txId, {
    description: 'F112_EDITED_SEARCH', amount: 88123
  });

  // Re-search to see edited version
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2000);
  await searchBox.fill('F112_EDITED_SEARCH');
  await searchBtn.click();
  await page.waitForTimeout(2000);

  const content2 = await page.textContent('body');
  const foundEdited = content2.includes('F112_EDITED_SEARCH');
  process.stdout.write('Found edited: ' + (foundEdited ? 'YES' : 'NO') + '\n');
  await page.screenshot({ path: path.join(DIR, 'feat112-search-edited.png') });

  // Delete via API
  await apiReq('DELETE', '/api/transactions/' + txId);

  // Re-search to confirm gone
  await page.goto(FRONTEND + '/ingresos');
  await page.waitForTimeout(2000);
  await searchBox.fill('F112_EDITED_SEARCH');
  await searchBtn.click();
  await page.waitForTimeout(2000);

  const content3 = await page.textContent('body');
  const notFound = !content3.includes('F112_EDITED_SEARCH');
  process.stdout.write('Gone after delete: ' + (notFound ? 'YES' : 'NO') + '\n');
  await page.screenshot({ path: path.join(DIR, 'feat112-search-deleted.png') });

  process.stdout.write('\nALL PASS: ' + (found && foundEdited && notFound ? 'YES' : 'NO') + '\n');
  await browser.close();
}

run().catch(err => {
  process.stdout.write('Error: ' + err.message + '\n' + err.stack + '\n');
  process.exit(1);
});
