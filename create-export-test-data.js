const http = require('http');

function post(path, data, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Login
  const login = await post('/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const token = login.token;
  console.log('Logged in');

  // Create January incomes
  const jan1 = await post('/api/transactions', {
    type: 'ingreso', amount: 200000, description: 'EXPORT_TEST_JAN_B',
    date: '2026-01-20', payer_name: 'January Payer 2', category_id: 1
  }, token);
  console.log('Created Jan B:', jan1.id);

  const jan2 = await post('/api/transactions', {
    type: 'ingreso', amount: 150000, description: 'EXPORT_TEST_JAN_C',
    date: '2026-01-25', payer_name: 'January Payer 3'
  }, token);
  console.log('Created Jan C:', jan2.id);

  // Create February income
  const feb1 = await post('/api/transactions', {
    type: 'ingreso', amount: 300000, description: 'EXPORT_TEST_FEB_A',
    date: '2026-02-10', payer_name: 'February Payer'
  }, token);
  console.log('Created Feb A:', feb1.id);

  const feb2 = await post('/api/transactions', {
    type: 'ingreso', amount: 400000, description: 'EXPORT_TEST_FEB_B',
    date: '2026-02-15', payer_name: 'February Payer 2', category_id: 1
  }, token);
  console.log('Created Feb B:', feb2.id);

  console.log('Done! Test data created for January and February.');
}

main().catch(console.error);
