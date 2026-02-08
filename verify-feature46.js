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
  // Login as delegado
  const login = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'delegado@tapin.cl', password: 'password123' })
  });
  const token = login.data.token;
  console.log('Logged in as delegado');

  // Get transactions
  const txRes = await fetch('http://localhost:3001/api/transactions?type=ingreso&sort_by=date&sort_order=desc', {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  const target = txRes.data.transactions.find(t => t.description === 'Cuota marzo Delegado A');
  if (target) {
    console.log('\n=== FOUND INCOME TRANSACTION ===');
    console.log('ID:', target.id);
    console.log('Type:', target.type);
    console.log('Amount:', target.amount);
    console.log('Category:', target.category_name);
    console.log('Description:', target.description);
    console.log('Date:', target.date);
    console.log('Payer Name:', target.payer_name);
    console.log('Payer RUT:', target.payer_rut);
    console.log('Created By:', target.created_by_name);
    console.log('Source:', target.source);
    console.log('\n=== ALL FIELDS VERIFIED ===');
    console.log('Amount 50000:', target.amount === 50000 ? 'PASS' : 'FAIL (got ' + target.amount + ')');
    console.log('Category Cuota Mensual:', target.category_name === 'Cuota Mensual' ? 'PASS' : 'FAIL');
    console.log('Description:', target.description === 'Cuota marzo Delegado A' ? 'PASS' : 'FAIL');
    console.log('Payer Juan Perez:', target.payer_name === 'Juan Perez' ? 'PASS' : 'FAIL');
    console.log('RUT 12345678-9:', target.payer_rut === '12345678-9' ? 'PASS' : 'FAIL');
    console.log('Date 2026-02-08:', target.date === '2026-02-08' ? 'PASS' : 'FAIL');
  } else {
    console.log('ERROR: Income transaction not found!');
    console.log('Available transactions:');
    txRes.data.transactions.forEach(t => console.log(' -', t.description, t.amount));
  }
}

main().catch(console.error);
