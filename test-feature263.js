const http = require('http');

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let bodyStr = null;
    if (body) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const opts = { hostname: 'localhost', port: 3001, path, method, headers };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const uniqueId = Date.now();

async function main() {
  const roles = [
    { email: 'delegado@tapin.cl', name: 'Carlos López', role: 'delegado' },
    { email: 'presidente@tapin.cl', name: 'María González', role: 'presidente' },
    { email: 'secretaria@tapin.cl', name: 'Ana Martínez', role: 'secretaria' },
  ];

  const createdIds = [];

  for (const role of roles) {
    // Login
    const loginRes = await request('POST', '/api/auth/login', null, { email: role.email, password: 'password123' });
    if (loginRes.status !== 200) {
      console.log('FAIL: Login failed for', role.email, loginRes.data);
      continue;
    }
    console.log('Logged in as', role.role, '(' + role.name + ')');

    // Create income
    const incomeData = {
      type: 'ingreso',
      amount: 10000 + Math.floor(Math.random() * 90000),
      category_id: 1,
      description: 'F263_' + role.role.toUpperCase() + '_' + uniqueId,
      date: '2026-02-09',
      payer_name: 'Pagador ' + role.role,
    };

    const createRes = await request('POST', '/api/transactions', loginRes.data.token, incomeData);
    if (createRes.status === 201) {
      console.log('  SUCCESS: Created income ID:', createRes.data.id, 'Amount:', incomeData.amount, 'Desc:', incomeData.description);
      createdIds.push(createRes.data.id);
    } else {
      console.log('  FAIL: Create income failed:', createRes.status, createRes.data);
    }
  }

  console.log('\nCreated IDs:', createdIds);

  // Now verify all three are visible in the list
  const presLogin = await request('POST', '/api/auth/login', null, { email: 'presidente@tapin.cl', password: 'password123' });
  const listRes = await request('GET', '/api/transactions?type=ingreso', presLogin.data.token);

  if (listRes.status === 200) {
    const all = Array.isArray(listRes.data) ? listRes.data : (listRes.data.transactions || []);
    console.log('\nTotal incomes in list:', all.length);

    // Check each created income is in the list
    for (const id of createdIds) {
      const found = all.find(t => t.id === id);
      if (found) {
        console.log('  Found ID', id, '- created_by:', found.created_by_name || found.created_by, '- desc:', found.description);
      } else {
        console.log('  FAIL: ID', id, 'not found in list');
      }
    }
  } else {
    console.log('FAIL: Could not get income list:', listRes.status, listRes.data);
  }

  console.log('\nUniqueId for UI verification:', uniqueId);
}

main().catch(console.error);
