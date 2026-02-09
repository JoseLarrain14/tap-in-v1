const http = require('http');

async function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login as presidente
  const loginRes = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' });
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const token = loginRes.token;
  console.log('Token obtained');

  // Get all payment requests
  const prRes = await fetch('http://localhost:3001/api/payment-requests?limit=100', { Authorization: 'Bearer ' + token });
  console.log('Total requests:', prRes.pagination.total);

  const byStatus = {};
  prRes.payment_requests.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });
  console.log('By status:', JSON.stringify(byStatus, null, 2));

  // Show details
  prRes.payment_requests.forEach(p => {
    console.log(`  [${p.status}] #${p.id}: ${p.description} - $${p.amount}`);
  });
}

main().catch(console.error);
