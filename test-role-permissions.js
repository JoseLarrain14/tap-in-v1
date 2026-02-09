// Test script for Feature #126: Role-based UI elements match backend permissions
const BASE = 'http://localhost:3001';

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  const data = await res.json();
  return data.token;
}

async function testAPI(method, path, token, body, isFormData) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}` }
  };
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const delegadoToken = await login('delegado@tapin.cl');
  const presidenteToken = await login('presidente@tapin.cl');
  const secretariaToken = await login('secretaria@tapin.cl');

  const results = [];

  // ===== TEST GROUP 1: CREATE payment request =====
  const createBody = { amount: 1000, category_id: 1, description: 'TEST_ROLE_126', beneficiary: 'Test Vendor 126' };

  let r = await testAPI('POST', '/api/payment-requests', secretariaToken, createBody);
  results.push({ test: 'Secretaria CREATE PR → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/payment-requests', delegadoToken, createBody);
  results.push({ test: 'Delegado CREATE PR → 201', pass: r.status === 201 });

  r = await testAPI('POST', '/api/payment-requests', presidenteToken, createBody);
  results.push({ test: 'Presidente CREATE PR → 201', pass: r.status === 201 });

  // ===== TEST GROUP 2: APPROVE payment request (only Presidente) =====
  // Use existing pendiente PR id=42
  r = await testAPI('POST', '/api/payment-requests/42/approve', delegadoToken);
  results.push({ test: 'Delegado APPROVE → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/payment-requests/42/approve', secretariaToken);
  results.push({ test: 'Secretaria APPROVE → 403', pass: r.status === 403 });

  // ===== TEST GROUP 3: REJECT payment request (only Presidente) =====
  // Use existing pendiente PR id=37
  r = await testAPI('POST', '/api/payment-requests/37/reject', delegadoToken, { comment: 'test reject' });
  results.push({ test: 'Delegado REJECT → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/payment-requests/37/reject', secretariaToken, { comment: 'test reject' });
  results.push({ test: 'Secretaria REJECT → 403', pass: r.status === 403 });

  // ===== TEST GROUP 4: EXECUTE payment request (only Secretaria) =====
  // Use existing aprobado PR id=35
  r = await testAPI('POST', '/api/payment-requests/35/execute', delegadoToken);
  results.push({ test: 'Delegado EXECUTE → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/payment-requests/35/execute', presidenteToken);
  results.push({ test: 'Presidente EXECUTE → 403', pass: r.status === 403 });

  // ===== TEST GROUP 5: User management (only Presidente) =====
  r = await testAPI('POST', '/api/users/invite', delegadoToken, { email: 'test126@test.cl', name: 'Test', role: 'delegado' });
  results.push({ test: 'Delegado INVITE user → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/users/invite', secretariaToken, { email: 'test126@test.cl', name: 'Test', role: 'delegado' });
  results.push({ test: 'Secretaria INVITE user → 403', pass: r.status === 403 });

  // ===== TEST GROUP 6: Category management (only Presidente) =====
  r = await testAPI('POST', '/api/categories', delegadoToken, { name: 'TestCat126', type: 'egreso' });
  results.push({ test: 'Delegado CREATE category → 403', pass: r.status === 403 });

  r = await testAPI('POST', '/api/categories', secretariaToken, { name: 'TestCat126', type: 'egreso' });
  results.push({ test: 'Secretaria CREATE category → 403', pass: r.status === 403 });

  // ===== TEST GROUP 7: Role change (only Presidente) =====
  r = await testAPI('PUT', '/api/users/3/role', delegadoToken, { role: 'presidente' });
  results.push({ test: 'Delegado CHANGE ROLE → 403', pass: r.status === 403 });

  r = await testAPI('PUT', '/api/users/3/role', secretariaToken, { role: 'presidente' });
  results.push({ test: 'Secretaria CHANGE ROLE → 403', pass: r.status === 403 });

  // ===== PRINT RESULTS =====
  console.log('\n=== ROLE-BASED API PERMISSION TESTS ===');
  let allPass = true;
  for (const t of results) {
    const status = t.pass ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${t.test}`);
    if (!t.pass) allPass = false;
  }
  console.log(`\n${results.filter(t => t.pass).length}/${results.length} tests passed`);
  if (allPass) console.log('ALL API PERMISSION TESTS PASSED!');
  else console.log('SOME TESTS FAILED');
}

main().catch(console.error);
