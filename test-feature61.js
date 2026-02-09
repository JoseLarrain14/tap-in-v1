const http = require('http');

const BASE = 'http://localhost:3001';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login as presidente
  const loginRes = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = loginRes.token;
  console.log('Logged in as presidente, id:', loginRes.user.id);

  // Login as delegado
  const delLogin = await request('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl',
    password: 'password123'
  });
  const delToken = delLogin.token;
  console.log('Logged in as delegado, id:', delLogin.user.id);

  // Check existing payment requests
  const existing = await request('GET', '/api/payment-requests', presToken);
  console.log('Existing payment requests response:', JSON.stringify(existing).substring(0, 500));

  // Get categories
  const cats = await request('GET', '/api/categories', presToken);
  console.log('Categories response:', JSON.stringify(cats).substring(0, 500));

  // Check dashboard summary
  const summary = await request('GET', '/api/dashboard/summary', presToken);
  console.log('Dashboard summary:', JSON.stringify(summary));
}

main().catch(console.error);
