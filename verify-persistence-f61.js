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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = presLogin.body.token;

  const summary = await request('GET', '/api/dashboard/summary', presToken);
  console.log('Dashboard after restart:');
  console.log('  pending_approval:', summary.body.pending_approval);
  console.log('  pending_execution:', summary.body.pending_execution);
  console.log('  balance:', summary.body.balance);

  // Verify our specific test PRs still exist
  const prs = await request('GET', '/api/payment-requests', presToken);
  const allPRs = prs.body.payment_requests || [];
  const testPRs = allPRs.filter(p => p.title && p.title.startsWith('F61_TEST'));
  console.log('Test PRs found:', testPRs.length);
  testPRs.forEach(p => console.log('  -', p.id, p.status, p.title));
}

main().catch(console.error);
