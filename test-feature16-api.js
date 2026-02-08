const http = require('http');

function request(method, path, body, token) {
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
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login as delegado
  const loginRes = await request('POST', '/api/auth/login', { email: 'delegado@tapin.cl', password: 'password123' });
  const delegadoToken = loginRes.body.token;
  console.log('Delegado login:', loginRes.status === 200 ? 'OK' : 'FAIL');

  // Test PUT /api/users/:id/role with Delegado token
  const roleRes = await request('PUT', '/api/users/1/role', { role: 'presidente' }, delegadoToken);
  console.log('PUT /api/users/1/role as Delegado:', roleRes.status, roleRes.status === 403 ? '✅ FORBIDDEN' : '❌ UNEXPECTED');

  // Test POST /api/users/invite with Delegado token
  const inviteRes = await request('POST', '/api/users/invite', { email: 'test@test.cl', role: 'delegado', name: 'Test' }, delegadoToken);
  console.log('POST /api/users/invite as Delegado:', inviteRes.status, inviteRes.status === 403 ? '✅ FORBIDDEN' : '❌ UNEXPECTED');

  // Verify Presidente CAN access these
  const presLoginRes = await request('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const presToken = presLoginRes.body.token;
  console.log('Presidente login:', presLoginRes.status === 200 ? 'OK' : 'FAIL');

  // Unauthenticated access
  const noAuthRes = await request('PUT', '/api/users/1/role', { role: 'delegado' });
  console.log('PUT /api/users/1/role without auth:', noAuthRes.status, noAuthRes.status === 401 ? '✅ UNAUTHORIZED' : '❌ UNEXPECTED');

  const noAuthInvite = await request('POST', '/api/users/invite', { email: 'x@x.cl', role: 'delegado', name: 'X' });
  console.log('POST /api/users/invite without auth:', noAuthInvite.status, noAuthInvite.status === 401 ? '✅ UNAUTHORIZED' : '❌ UNEXPECTED');
}

main().catch(console.error);
