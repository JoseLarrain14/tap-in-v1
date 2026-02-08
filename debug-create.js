const http = require('http');

function makeRequest(method, path, body, token) {
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const login = await makeRequest('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const token = JSON.parse(login.raw).token;
  console.log('Token obtained');

  const create = await makeRequest('POST', '/api/payment-requests', {
    amount: 10000, description: 'DEBUG_CREATE', beneficiary: 'Debug Vendor', status: 'pendiente'
  }, token);
  console.log('Create status:', create.status);
  console.log('Create body:', create.raw);

  // List payment requests
  const list = await makeRequest('GET', '/api/payment-requests', null, token);
  const parsed = JSON.parse(list.raw);
  console.log('\nTotal requests:', parsed.payment_requests.length);
  if (parsed.payment_requests.length > 0) {
    const last = parsed.payment_requests[0];
    console.log('First request ID:', last.id, 'Description:', last.description, 'Status:', last.status);
  }
}

run().catch(console.error);
