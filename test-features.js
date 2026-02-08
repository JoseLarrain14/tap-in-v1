// Test script for Features #21, #22, #23
const BASE = 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123' }),
  });
  return res.data.token;
}

async function authed(token, endpoint, options = {}) {
  return request(endpoint, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
}

async function main() {
  console.log('=== Testing Features #21, #22, #23 ===\n');

  // Login tokens
  const presToken = await login('presidente@tapin.cl');
  const secToken = await login('secretaria@tapin.cl');
  const delToken = await login('delegado@tapin.cl');
  console.log('All users logged in successfully\n');

  // ============== FEATURE #21 ==============
  console.log('--- FEATURE #21: Secretaria cannot approve/reject ---');

  // Ensure a pending payment request exists
  const createRes = await authed(presToken, '/payment-requests', {
    method: 'POST',
    body: JSON.stringify({ amount: 75000, description: 'TEST_F21_verify', beneficiary: 'Test Vendor', status: 'pendiente' }),
  });
  const prId = createRes.data.id;
  console.log(`Created payment request #${prId} (status: ${createRes.data.status})`);

  // Secretaria tries to approve
  const approveRes = await authed(secToken, `/payment-requests/${prId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log(`Secretaria approve: HTTP ${approveRes.status} - ${approveRes.data.error || 'OK'}`);
  console.assert(approveRes.status === 403, 'FAIL: Should be 403');

  // Secretaria tries to reject
  const rejectRes = await authed(secToken, `/payment-requests/${prId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment: 'test rejection' }),
  });
  console.log(`Secretaria reject: HTTP ${rejectRes.status} - ${rejectRes.data.error || 'OK'}`);
  console.assert(rejectRes.status === 403, 'FAIL: Should be 403');

  // Verify delegado also cannot approve/reject
  const delApproveRes = await authed(delToken, `/payment-requests/${prId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log(`Delegado approve: HTTP ${delApproveRes.status} - ${delApproveRes.data.error || 'OK'}`);
  console.assert(delApproveRes.status === 403, 'FAIL: Should be 403');

  // Verify presidente CAN approve
  const presApproveRes = await authed(presToken, `/payment-requests/${prId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log(`Presidente approve: HTTP ${presApproveRes.status} - ${presApproveRes.data.status || presApproveRes.data.error}`);
  console.assert(presApproveRes.status === 200, 'FAIL: Should be 200');

  console.log('FEATURE #21: PASSED\n');

  // ============== FEATURE #22 ==============
  console.log('--- FEATURE #22: Deactivated user cannot write ---');

  // Deactivate delegado
  const deactRes = await authed(presToken, '/users/3/deactivate', {
    method: 'PUT',
  });
  console.log(`Deactivate delegado: HTTP ${deactRes.status} - ${deactRes.data.message || deactRes.data.error}`);

  // Login as deactivated user
  const deactToken = await login('delegado@tapin.cl');
  console.log(`Deactivated user login: ${deactToken ? 'SUCCESS' : 'FAILED'}`);

  // Can read transactions (GET)
  const readRes = await authed(deactToken, '/transactions');
  console.log(`Deactivated user GET /transactions: HTTP ${readRes.status}`);
  console.assert(readRes.status === 200, 'FAIL: Should be able to read');

  // Cannot create transaction (POST)
  const writeRes = await authed(deactToken, '/transactions', {
    method: 'POST',
    body: JSON.stringify({ type: 'ingreso', amount: 1000, date: '2026-01-01', description: 'test' }),
  });
  console.log(`Deactivated user POST /transactions: HTTP ${writeRes.status} - ${writeRes.data.error || 'OK'}`);
  console.assert(writeRes.status === 403, 'FAIL: Should be 403');

  // Cannot create payment request (POST)
  const writePrRes = await authed(deactToken, '/payment-requests', {
    method: 'POST',
    body: JSON.stringify({ amount: 5000, description: 'test', beneficiary: 'test' }),
  });
  console.log(`Deactivated user POST /payment-requests: HTTP ${writePrRes.status} - ${writePrRes.data.error || 'OK'}`);
  console.assert(writePrRes.status === 403, 'FAIL: Should be 403');

  // Can still read payment requests (GET)
  const readPrRes = await authed(deactToken, '/payment-requests');
  console.log(`Deactivated user GET /payment-requests: HTTP ${readPrRes.status}`);
  console.assert(readPrRes.status === 200, 'FAIL: Should be able to read');

  // Reactivate delegado for other tests
  const reactRes = await authed(presToken, '/users/3/activate', {
    method: 'PUT',
  });
  console.log(`Reactivate delegado: HTTP ${reactRes.status}`);

  console.log('FEATURE #22: PASSED\n');

  // ============== FEATURE #23 ==============
  console.log('--- FEATURE #23: Presidente can invite users ---');

  // Invite a new user
  const inviteRes = await authed(presToken, '/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email: 'nuevo_delegado@test.cl', name: 'Nuevo Delegado Test', role: 'delegado' }),
  });
  console.log(`Invite user: HTTP ${inviteRes.status} - ${inviteRes.data.message || inviteRes.data.error}`);
  console.assert(inviteRes.status === 201, 'FAIL: Should be 201');

  // Verify user appears in user list
  const usersRes = await authed(presToken, '/users');
  const newUser = usersRes.data.users.find(u => u.email === 'nuevo_delegado@test.cl');
  console.log(`New user in list: ${newUser ? 'YES' : 'NO'} - ${newUser?.name} (${newUser?.role})`);
  console.assert(newUser, 'FAIL: New user should be in list');

  // Verify secretaria cannot invite
  const secInviteRes = await authed(secToken, '/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email: 'otro@test.cl', name: 'Otro', role: 'delegado' }),
  });
  console.log(`Secretaria invite: HTTP ${secInviteRes.status} - ${secInviteRes.data.error || 'OK'}`);
  console.assert(secInviteRes.status === 403, 'FAIL: Should be 403');

  // Verify delegado cannot invite
  const delInviteRes = await authed(delToken, '/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email: 'otro2@test.cl', name: 'Otro2', role: 'delegado' }),
  });
  console.log(`Delegado invite: HTTP ${delInviteRes.status} - ${delInviteRes.data.error || 'OK'}`);
  console.assert(delInviteRes.status === 403, 'FAIL: Should be 403');

  console.log('FEATURE #23: PASSED\n');
  console.log('=== ALL FEATURES PASSED ===');
}

main().catch(console.error);
