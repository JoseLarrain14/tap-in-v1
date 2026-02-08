const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  const login = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'delegado@tapin.cl', password: 'password123' })
  });
  const token = login.data.token;
  console.log('Logged in as delegado');

  // Create income with amount 10000
  const createRes = await fetch('http://localhost:3001/api/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      type: 'ingreso',
      amount: 10000,
      category_id: 1,
      description: 'EDIT_TEST_48',
      date: '2026-02-08',
      payer_name: 'Original Payer',
      payer_rut: '11111111-1'
    })
  });

  console.log('Created transaction ID:', createRes.data.id);
  console.log('Amount:', createRes.data.amount);
  console.log('Description:', createRes.data.description);
}

main().catch(console.error);
