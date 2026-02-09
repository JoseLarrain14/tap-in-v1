const http = require('http');
const fs = require('fs');
const path = require('path');

function request(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
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

function uploadExecute(urlPath, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const comment = 'Ejecutado para test Feature #81';

    let body = '';
    body += '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="comment"\r\n\r\n';
    body += comment + '\r\n';
    body += '--' + boundary + '--\r\n';

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(body),
        'Authorization': 'Bearer ' + token
      }
    };

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
    req.write(body);
    req.end();
  });
}

async function main() {
  // Login as delegado
  const delegadoLogin = await request('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  const delegadoToken = delegadoLogin.body.token;
  console.log('1. Delegado logged in');

  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  const presToken = presLogin.body.token;
  console.log('2. Presidente logged in');

  // Login as secretaria
  const secLogin = await request('POST', '/api/auth/login', null, {
    email: 'secretaria@tapin.cl', password: 'password123'
  });
  const secToken = secLogin.body.token;
  console.log('3. Secretaria logged in');

  // Create payment request as delegado (directly as pendiente)
  const createRes = await request('POST', '/api/payment-requests', delegadoToken, {
    amount: 75000,
    description: 'TEST_F81_EXECUTED_CHECK',
    beneficiary: 'Test Beneficiary F81',
    status: 'pendiente'
  });
  const prId = createRes.body.id;
  console.log('4. Created PR #' + prId + ' status:', createRes.body.status);

  // Approve as presidente
  const approveRes = await request('POST', '/api/payment-requests/' + prId + '/approve', presToken, {
    comment: 'Aprobado para F81 test'
  });
  console.log('5. Approved:', approveRes.body.status);

  // Execute as secretaria
  const execRes = await uploadExecute('/api/payment-requests/' + prId + '/execute', secToken);
  console.log('6. Executed:', execRes.status, 'status:', execRes.body.status);

  // Now try all invalid transitions on the executed request
  const approveAgain = await request('POST', '/api/payment-requests/' + prId + '/approve', presToken, {});
  console.log('7. Try approve executed:', approveAgain.status, '(expect 400)', approveAgain.body.error);

  const rejectRes = await request('POST', '/api/payment-requests/' + prId + '/reject', presToken, {
    comment: 'Trying to reject executed'
  });
  console.log('8. Try reject executed:', rejectRes.status, '(expect 400)', rejectRes.body.error);

  const execAgain = await uploadExecute('/api/payment-requests/' + prId + '/execute', secToken);
  console.log('9. Try execute again:', execAgain.status, '(expect 400)', execAgain.body.error);

  const submitRes = await request('POST', '/api/payment-requests/' + prId + '/submit', delegadoToken, {});
  console.log('10. Try submit executed:', submitRes.status, '(expect 400)', submitRes.body.error);

  // Verify final status
  const checkRes = await request('GET', '/api/payment-requests/' + prId, presToken);
  console.log('11. Final status:', checkRes.body.status, '(expect ejecutado)');

  // Summary
  const allPass = approveAgain.status === 400 && rejectRes.status === 400 &&
                  execAgain.status === 400 && checkRes.body.status === 'ejecutado';
  console.log('\n=== Feature #81 API Test:', allPass ? 'PASS' : 'FAIL', '===');
  console.log('PR ID for UI test:', prId);
}

main().catch(console.error);
