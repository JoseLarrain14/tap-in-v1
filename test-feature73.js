// Test script for Feature #73 - User list shows all CPP members
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
        try { resolve(JSON.parse(body)); } catch(e) { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login as presidente
  const loginRes = await apiCall('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  console.log('Login:', loginRes.user ? 'OK' : 'FAILED');
  const token = loginRes.token;

  // Get users list
  const usersRes = await apiCall('GET', '/api/users', token);
  console.log('\n=== Users in Organization ===');
  console.log('Total users:', usersRes.users.length);
  usersRes.users.forEach(u => {
    console.log(`  - ${u.name} | ${u.email} | ${u.role} | active=${u.is_active}`);
  });

  // Check all required fields
  const firstUser = usersRes.users[0];
  console.log('\n=== Field Check ===');
  console.log('Has name:', 'name' in firstUser);
  console.log('Has email:', 'email' in firstUser);
  console.log('Has role:', 'role' in firstUser);
  console.log('Has is_active:', 'is_active' in firstUser);

  // All users should be org 1
  const allOrg1 = usersRes.users.every(u => u.organization_id === 1);
  console.log('All users from org 1:', allOrg1);

  // Check if org2 user exists
  try {
    const org2Login = await apiCall('POST', '/api/auth/login', null, {
      email: 'org2_presidente@tapin.cl',
      password: 'password123'
    });
    if (org2Login.token) {
      const org2Users = await apiCall('GET', '/api/users', org2Login.token);
      console.log('\n=== Org 2 Users ===');
      console.log('Org 2 user count:', org2Users.users.length);
      // Verify no org1 users appear in org2 list
      const hasOrg1 = org2Users.users.some(u => u.organization_id === 1);
      console.log('Org 2 list contains org 1 users:', hasOrg1, '(should be false)');
    } else {
      console.log('\nNo org2 user exists - org isolation cannot be tested via separate org');
    }
  } catch(e) {
    console.log('\nOrg2 login failed - only one org exists');
  }
}

main().catch(console.error);
