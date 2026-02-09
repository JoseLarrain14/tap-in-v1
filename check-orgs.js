// Check organizations and users per org
const http = require('http');

function apiCall(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login as presidente org1
  const login1 = await apiCall('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  const token1 = login1.data.token;

  // Try to login as org2 presidente
  const login2 = await apiCall('POST', '/api/auth/login', null, {
    email: 'org2_presidente@tapin.cl', password: 'password123'
  });

  if (login2.data.token) {
    const token2 = login2.data.token;
    console.log('Org2 user exists!');

    // Get org2 users
    const org2Users = await apiCall('GET', '/api/users', token2);
    console.log('Org2 users:', org2Users.data.users.length);
    org2Users.data.users.forEach(u => {
      console.log(`  - ${u.name} | ${u.email} | org=${u.organization_id}`);
    });

    // Verify isolation - org2 should NOT see org1 users
    const hasOrg1Users = org2Users.data.users.some(u => u.organization_id === 1);
    console.log('Org2 sees org1 users:', hasOrg1Users, '(should be false)');
  } else {
    console.log('No org2 user exists. Creating org2 for isolation test...');
    // We need to check if the setup-org-b script exists
    console.log('Login response:', JSON.stringify(login2.data));
  }
}

main().catch(console.error);
