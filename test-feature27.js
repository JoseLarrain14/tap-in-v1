// Test Feature #27: Delegado cannot manage users
// Tests that delegado gets 403 on invite, role change, and deactivate endpoints

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
      headers: {
        'Content-Type': 'application/json',
      }
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

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', null, { email, password });
  return res.body.token;
}

async function runTests() {
  console.log('=== Feature #27: Delegado cannot manage users ===\n');

  // Login as delegado
  const delToken = await login('delegado@tapin.cl', 'password123');
  console.log('Logged in as delegado');

  // Test 1: POST /api/users/invite with delegado token
  console.log('\nTest 1: Delegado tries to invite user...');
  const inviteRes = await request('POST', '/api/users/invite', delToken, {
    email: 'test_f27_invite@tapin.cl',
    name: 'Test F27 Invite',
    role: 'delegado'
  });
  console.log('  Status:', inviteRes.status, '| Body:', JSON.stringify(inviteRes.body));
  console.log('  PASS:', inviteRes.status === 403 ? 'YES' : 'NO');

  // Test 2: PUT /api/users/1/role with delegado token
  console.log('\nTest 2: Delegado tries to change user role...');
  const roleRes = await request('PUT', '/api/users/2/role', delToken, {
    role: 'delegado'
  });
  console.log('  Status:', roleRes.status, '| Body:', JSON.stringify(roleRes.body));
  console.log('  PASS:', roleRes.status === 403 ? 'YES' : 'NO');

  // Test 3: PUT /api/users/2/deactivate with delegado token
  console.log('\nTest 3: Delegado tries to deactivate user...');
  const deactRes = await request('PUT', '/api/users/2/deactivate', delToken, {});
  console.log('  Status:', deactRes.status, '| Body:', JSON.stringify(deactRes.body));
  console.log('  PASS:', deactRes.status === 403 ? 'YES' : 'NO');

  // Verify presidente CAN do these operations
  const presToken = await login('presidente@tapin.cl', 'password123');
  console.log('\n--- Verifying presidente CAN manage users ---');

  // Presidente invite - should succeed
  console.log('\nTest 4: Presidente invites user (should succeed)...');
  const presInviteRes = await request('POST', '/api/users/invite', presToken, {
    email: 'test_f27_pres@tapin.cl',
    name: 'Test F27 Pres',
    role: 'delegado'
  });
  console.log('  Status:', presInviteRes.status, '| Body:', JSON.stringify(presInviteRes.body));
  console.log('  PASS:', presInviteRes.status === 201 ? 'YES' : 'NO');

  const allPass = inviteRes.status === 403 && roleRes.status === 403 && deactRes.status === 403 && presInviteRes.status === 201;
  console.log('\n=== ALL TESTS:', allPass ? 'PASSED' : 'FAILED', '===');
}

runTests().catch(console.error);
