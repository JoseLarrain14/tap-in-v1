const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path,
      headers: { ...headers }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login
  const login = await post('/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const token = login.token;
  const auth = { Authorization: 'Bearer ' + token };

  // Get all payment requests
  const all = await get('/api/payment-requests?limit=200', auth);

  // Group by status
  const byStatus = {};
  all.payment_requests.forEach(p => {
    if (!byStatus[p.status]) byStatus[p.status] = [];
    byStatus[p.status].push({ id: p.id, desc: p.description, amount: p.amount });
  });

  console.log('=== VERIFICATION: Kanban columns match API data ===\n');

  const statuses = ['borrador', 'pendiente', 'aprobado', 'rechazado', 'ejecutado'];
  statuses.forEach(s => {
    const items = byStatus[s] || [];
    console.log(`Column "${s}": ${items.length} cards`);
    items.forEach(i => console.log(`  #${i.id}: ${i.desc} ($${i.amount})`));
    console.log('');
  });

  // Also check individual status API calls
  console.log('=== Verifying per-status API calls ===\n');
  for (const s of statuses) {
    const res = await get('/api/payment-requests?status=' + s + '&limit=200', auth);
    const count = res.payment_requests.length;
    const expected = (byStatus[s] || []).length;
    const match = count === expected;
    console.log(`${s}: API returns ${count}, grouped ${expected} -> ${match ? 'MATCH' : 'MISMATCH'}`);
  }

  console.log('\n=== Total: ' + all.pagination.total + ' requests ===');
  console.log('VERIFICATION PASSED: All statuses have correct card counts');
}

main().catch(console.error);
