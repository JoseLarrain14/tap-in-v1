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
  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = presLogin.body.token;

  // Approve PR 19 (one of our test PRs)
  const approveRes = await request('POST', '/api/payment-requests/19/approve', presToken);
  console.log('Approved PR 19:', approveRes.status, approveRes.body.status || approveRes.body.error);

  // Check dashboard
  const summary = await request('GET', '/api/dashboard/summary', presToken);
  console.log('Dashboard after approving PR 19:');
  console.log('  pending_approval:', summary.body.pending_approval);
  console.log('  pending_execution:', summary.body.pending_execution);
  console.log('Expected: pending_approval = 7, pending_execution = 3');
}

main().catch(console.error);
