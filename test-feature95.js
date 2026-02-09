const http = require('http');

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let bodyStr = null;
    if (body) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const opts = { hostname: 'localhost', port: 3001, path, method, headers };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Login as presidente to create and approve a request
  const presLogin = await request('POST', '/api/auth/login', null, { email: 'presidente@tapin.cl', password: 'password123' });
  const presToken = presLogin.data.token;
  console.log('1. Logged in as presidente');

  // Create a payment request
  const createRes = await request('POST', '/api/payment-requests', presToken, {
    amount: 50000,
    description: 'TEST_COMPROBANTE_95_' + Date.now(),
    beneficiary: 'Test Vendor Feature95',
    category_id: 1
  });
  console.log('2. Created request:', createRes.status, 'ID:', createRes.data.id);

  // Submit it
  const submitRes = await request('POST', '/api/payment-requests/' + createRes.data.id + '/submit', presToken, {});
  console.log('3. Submitted:', submitRes.status);

  // Approve it
  const approveRes = await request('POST', '/api/payment-requests/' + createRes.data.id + '/approve', presToken, {});
  console.log('4. Approved:', approveRes.status);

  // Login as secretaria
  const secLogin = await request('POST', '/api/auth/login', null, { email: 'secretaria@tapin.cl', password: 'password123' });
  const secToken = secLogin.data.token;
  console.log('5. Logged in as secretaria');

  // Try executing without comprobante (plain JSON POST, no file)
  const execRes = await request('POST', '/api/payment-requests/' + createRes.data.id + '/execute', secToken, {});
  console.log('6. Execute WITHOUT comprobante:');
  console.log('   Status:', execRes.status);
  console.log('   Response:', JSON.stringify(execRes.data));

  if (execRes.status === 400 && execRes.data.error && execRes.data.error.includes('comprobante')) {
    console.log('   SUCCESS: Backend correctly rejects execution without comprobante');
  } else {
    console.log('   FAIL: Backend should have rejected with 400');
  }
}

main().catch(console.error);
