const http = require('http');

const BASE = 'http://localhost:3001';

function request(method, path, token) {
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
    req.end();
  });
}

async function main() {
  const login = await request('POST', '/api/auth/login', null);
  // Use curl-style login
  const http2 = require('http');
  const loginRes = await new Promise((resolve, reject) => {
    const req = http2.request({
      hostname: 'localhost', port: 3001, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' }));
    req.end();
  });

  const token = loginRes.token;
  const prs = await request('GET', '/api/payment-requests', token);
  const allPRs = prs.payment_requests || [];

  // Show PR IDs 18, 19, 20 specifically
  allPRs.filter(p => p.id >= 18 && p.id <= 20).forEach(p => {
    console.log('PR', p.id, '- status:', p.status, '- desc:', p.description);
  });

  console.log('\nAll PRs count:', allPRs.length);
  const statusCount = {};
  allPRs.forEach(p => { statusCount[p.status] = (statusCount[p.status] || 0) + 1; });
  console.log('Status breakdown:', JSON.stringify(statusCount));
}

main().catch(console.error);
