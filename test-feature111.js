// Feature #111: Category dropdown populated from database
// Test: Verify income and expense forms load categories from API, not hardcoded
const http = require('http');

const BASE = 'http://localhost:3001';
let TOKEN = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
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
  // Step 1: Login as presidente
  const loginRes = await request('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  TOKEN = loginRes.body.token;
  process.stdout.write('1. Login: ' + (TOKEN ? 'OK' : 'FAIL') + '\n');

  // Step 2: Get ingreso categories
  const ingresoRes = await request('GET', '/api/categories?type=ingreso');
  const ingresoCats = ingresoRes.body.categories || [];
  process.stdout.write('2. Ingreso categories from API: ' + ingresoCats.length + ' items\n');
  ingresoCats.forEach(c => process.stdout.write('   - ' + c.name + ' (id:' + c.id + ')\n'));

  // Step 3: Get egreso categories
  const egresoRes = await request('GET', '/api/categories?type=egreso');
  const egresoCats = egresoRes.body.categories || [];
  process.stdout.write('3. Egreso categories from API: ' + egresoCats.length + ' items\n');
  egresoCats.forEach(c => process.stdout.write('   - ' + c.name + ' (id:' + c.id + ')\n'));

  // Step 4: Create a new egreso category as Presidente
  const newCatName = 'TEST_CAT_111_' + Date.now();
  const createRes = await request('POST', '/api/categories', { name: newCatName, type: 'egreso' });
  const newCatId = createRes.body.category ? createRes.body.category.id : (createRes.body.id || null);
  process.stdout.write('4. Create new category "' + newCatName + '": status=' + createRes.status + ' id=' + newCatId + '\n');

  // Step 5: Verify new category appears in egreso list
  const egresoRes2 = await request('GET', '/api/categories?type=egreso');
  const egresoCats2 = egresoRes2.body.categories || [];
  const foundNew = egresoCats2.find(c => c.name === newCatName);
  process.stdout.write('5. New category in egreso list: ' + (foundNew ? 'FOUND' : 'NOT FOUND') + '\n');
  process.stdout.write('   Total egreso categories now: ' + egresoCats2.length + '\n');

  // Step 6: Also create a new ingreso category
  const newIngCatName = 'TEST_ING_111_' + Date.now();
  const createIngRes = await request('POST', '/api/categories', { name: newIngCatName, type: 'ingreso' });
  const newIngCatId = createIngRes.body.category ? createIngRes.body.category.id : (createIngRes.body.id || null);
  process.stdout.write('6. Create ingreso category "' + newIngCatName + '": status=' + createIngRes.status + ' id=' + newIngCatId + '\n');

  // Step 7: Verify new ingreso category appears
  const ingresoRes2 = await request('GET', '/api/categories?type=ingreso');
  const ingresoCats2 = ingresoRes2.body.categories || [];
  const foundNewIng = ingresoCats2.find(c => c.name === newIngCatName);
  process.stdout.write('7. New category in ingreso list: ' + (foundNewIng ? 'FOUND' : 'NOT FOUND') + '\n');

  // Cleanup: Delete test categories
  if (newCatId) {
    const del1 = await request('DELETE', '/api/categories/' + newCatId);
    process.stdout.write('8. Cleanup egreso test cat: status=' + del1.status + '\n');
  }
  if (newIngCatId) {
    const del2 = await request('DELETE', '/api/categories/' + newIngCatId);
    process.stdout.write('9. Cleanup ingreso test cat: status=' + del2.status + '\n');
  }

  // Summary
  process.stdout.write('\n=== FEATURE #111 API VERIFICATION ===\n');
  process.stdout.write('Ingreso categories loaded from DB: ' + (ingresoCats.length > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Egreso categories loaded from DB: ' + (egresoCats.length > 0 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('New category appears dynamically: ' + (foundNew ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Overall: ' + (ingresoCats.length > 0 && egresoCats.length > 0 && foundNew ? 'ALL PASS' : 'SOME FAILURES') + '\n');
}

run().catch(err => process.stdout.write('Error: ' + err.message + '\n'));
