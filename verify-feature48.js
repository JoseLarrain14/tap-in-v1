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

  // Get the edited transaction
  const txRes = await fetch('http://localhost:3001/api/transactions?type=ingreso&sort_by=date&sort_order=desc', {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  const target = txRes.data.transactions.find(t => t.description === 'EDIT_TEST_48');
  if (target) {
    console.log('=== EDIT_TEST_48 Transaction ===');
    console.log('ID:', target.id);
    console.log('Amount:', target.amount, '(expected: 20000)');
    console.log('Amount correct:', target.amount === 20000 ? 'PASS' : 'FAIL');
    console.log('Category:', target.category_name);
    console.log('Payer:', target.payer_name);
    console.log('edited_by:', target.edited_by);
    console.log('edited_at:', target.edited_at);
    console.log('edited_by set:', target.edited_by ? 'PASS' : 'FAIL');
    console.log('edited_at set:', target.edited_at ? 'PASS' : 'FAIL');
    console.log('edited_by_name:', target.edited_by_name);

    // Check audit trail
    const auditRes = await fetch('http://localhost:3001/api/transactions/' + target.id + '/audit', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('\n=== Audit Trail ===');
    auditRes.data.forEach(entry => {
      console.log(entry.action, '-', entry.user_name, '-', entry.created_at, '-', entry.changes);
    });
  } else {
    console.log('ERROR: EDIT_TEST_48 not found');
  }
}

main().catch(console.error);
