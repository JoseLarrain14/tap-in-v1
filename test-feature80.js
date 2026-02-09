const http = require('http');

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login as delegado to create request
  const delegadoLogin = await request('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  const delegadoToken = delegadoLogin.body.token;
  console.log('1. Delegado logged in:', !!delegadoToken);

  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  const presToken = presLogin.body.token;
  console.log('2. Presidente logged in:', !!presToken);

  // Login as secretaria
  const secLogin = await request('POST', '/api/auth/login', null, {
    email: 'secretaria@tapin.cl', password: 'password123'
  });
  const secToken = secLogin.body.token;
  console.log('3. Secretaria logged in:', !!secToken);

  // Create payment request as delegado (directly as pendiente)
  const createRes = await request('POST', '/api/payment-requests', delegadoToken, {
    amount: 50000,
    description: 'TEST_F80_REJECT_CHECK',
    beneficiary: 'Test Beneficiary F80',
    status: 'pendiente'
  });
  const prId = createRes.body.id;
  console.log('4. Created payment request ID:', prId, 'status:', createRes.body.status);

  // Reject it as presidente with comment
  const rejectRes = await request('POST', '/api/payment-requests/' + prId + '/reject', presToken, {
    comment: 'Rechazado para test Feature #80'
  });
  console.log('5. Rejected:', rejectRes.status, 'new status:', rejectRes.body.status);

  // Now try to approve the rejected request
  const approveRes = await request('POST', '/api/payment-requests/' + prId + '/approve', presToken, {});
  console.log('6. Try approve rejected:', approveRes.status, '(expect 400)', approveRes.body.error);

  // Try to execute the rejected request
  const execRes = await request('POST', '/api/payment-requests/' + prId + '/execute', secToken, {});
  console.log('7. Try execute rejected:', execRes.status, '(expect 400)', execRes.body.error);

  // Try to submit it again
  const submitRes = await request('POST', '/api/payment-requests/' + prId + '/submit', delegadoToken, {});
  console.log('8. Try submit rejected:', submitRes.status, '(expect 400)', submitRes.body.error);

  // Verify status is still rechazado
  const checkRes = await request('GET', '/api/payment-requests/' + prId, presToken);
  console.log('9. Final status:', checkRes.body.status, '(expect rechazado)');

  // Summary
  const allPass = approveRes.status === 400 && execRes.status === 400 && checkRes.body.status === 'rechazado';
  console.log('\n=== Feature #80 API Test:', allPass ? 'PASS' : 'FAIL', '===');
  console.log('PR ID for UI test:', prId);
}

main().catch(console.error);
