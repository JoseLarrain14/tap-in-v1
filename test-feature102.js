// Feature #102: API validates request body schema
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) });
        } catch(e) {
          resolve({ status: res.statusCode, body: b });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login first
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const token = loginRes.body.token;
  console.log('Login:', loginRes.status === 200 ? 'OK' : 'FAIL');

  // Test 1: POST /api/transactions with empty body
  console.log('\n--- Test 1: Empty body ---');
  const t1 = await request('POST', '/api/transactions', {}, token);
  console.log('Status:', t1.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t1.body));
  console.log('PASS:', t1.status === 400 && t1.body.error ? 'YES' : 'NO');

  // Test 2: POST with missing required field (amount)
  console.log('\n--- Test 2: Missing amount ---');
  const t2 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    date: '2026-01-15'
    // amount missing
  }, token);
  console.log('Status:', t2.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t2.body));
  console.log('PASS:', t2.status === 400 && t2.body.error ? 'YES' : 'NO');

  // Test 3: POST with amount as string instead of number
  console.log('\n--- Test 3: Amount as string ---');
  const t3 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 'not-a-number',
    date: '2026-01-15'
  }, token);
  console.log('Status:', t3.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t3.body));
  console.log('PASS:', t3.status === 400 && t3.body.error ? 'YES' : 'NO');

  // Test 4: POST with invalid type
  console.log('\n--- Test 4: Invalid type ---');
  const t4 = await request('POST', '/api/transactions', {
    type: 'invalid_type',
    amount: 5000,
    date: '2026-01-15'
  }, token);
  console.log('Status:', t4.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t4.body));
  console.log('PASS:', t4.status === 400 && t4.body.error ? 'YES' : 'NO');

  // Test 5: POST with negative amount
  console.log('\n--- Test 5: Negative amount ---');
  const t5 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    amount: -1000,
    date: '2026-01-15'
  }, token);
  console.log('Status:', t5.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t5.body));
  console.log('PASS:', t5.status === 400 && t5.body.error ? 'YES' : 'NO');

  // Test 6: POST with zero amount
  console.log('\n--- Test 6: Zero amount ---');
  const t6 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 0,
    date: '2026-01-15'
  }, token);
  console.log('Status:', t6.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t6.body));
  console.log('PASS:', t6.status === 400 && t6.body.error ? 'YES' : 'NO');

  // Test 7: POST with invalid category_id
  console.log('\n--- Test 7: Invalid category_id ---');
  const t7 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 5000,
    date: '2026-01-15',
    category_id: 99999
  }, token);
  console.log('Status:', t7.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t7.body));
  console.log('PASS:', t7.status === 400 && t7.body.error ? 'YES' : 'NO');

  // Test 8: Valid POST should work (control test)
  console.log('\n--- Test 8: Valid POST (control) ---');
  const t8 = await request('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 1000,
    date: '2026-01-15',
    description: 'TEST_VALIDATION_102'
  }, token);
  console.log('Status:', t8.status, '(expected 201)');
  console.log('PASS:', t8.status === 201 ? 'YES' : 'NO');

  // Cleanup: delete the test transaction
  if (t8.status === 201 && t8.body.id) {
    const del = await request('DELETE', `/api/transactions/${t8.body.id}`, null, token);
    console.log('Cleanup:', del.status === 200 ? 'OK' : 'FAIL');
  }

  // Test 9: POST /api/payment-requests with empty body
  console.log('\n--- Test 9: Payment request empty body ---');
  const t9 = await request('POST', '/api/payment-requests', {}, token);
  console.log('Status:', t9.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t9.body));
  console.log('PASS:', t9.status === 400 && t9.body.error ? 'YES' : 'NO');

  // Test 10: Payment request with amount as string
  console.log('\n--- Test 10: Payment request amount as string ---');
  const t10 = await request('POST', '/api/payment-requests', {
    amount: 'text',
    description: 'test',
    beneficiary: 'test'
  }, token);
  console.log('Status:', t10.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t10.body));
  console.log('PASS:', t10.status === 400 && t10.body.error ? 'YES' : 'NO');

  // Test 11: Payment request missing description
  console.log('\n--- Test 11: Payment request missing description ---');
  const t11 = await request('POST', '/api/payment-requests', {
    amount: 5000,
    beneficiary: 'test'
    // description missing
  }, token);
  console.log('Status:', t11.status, '(expected 400)');
  console.log('Response:', JSON.stringify(t11.body));
  console.log('PASS:', t11.status === 400 && t11.body.error ? 'YES' : 'NO');

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
