// Verify Feature #114: Pipeline Kanban shows correct cards per column
const http = require('http');

const API = 'http://localhost:3001';

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function main() {
  // Login as presidente
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    body: { email: 'presidente@tapin.cl', password: 'password123' }
  });
  const token = loginRes.data.token;
  console.log('Logged in as presidente');

  // Get all payment requests
  const prRes = await fetch(`${API}/api/payment-requests?sort_by=created_at&sort_order=desc&limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const requests = prRes.data.payment_requests;
  console.log(`Total requests: ${requests.length}`);

  // Count by status
  const statusCounts = {};
  const statuses = ['borrador', 'pendiente', 'aprobado', 'rechazado', 'ejecutado'];
  statuses.forEach(s => statusCounts[s] = 0);

  requests.forEach(r => {
    if (statusCounts[r.status] !== undefined) statusCounts[r.status]++;
  });

  console.log('\nExpected Kanban column counts:');
  statuses.forEach(s => {
    console.log(`  ${s}: ${statusCounts[s]} cards`);
  });

  // List a few per column for reference
  console.log('\nSample cards per column:');
  statuses.forEach(s => {
    const items = requests.filter(r => r.status === s).slice(0, 3);
    console.log(`  ${s}:`);
    items.forEach(r => console.log(`    #${r.id} - ${r.description?.substring(0, 40)} - ${r.amount}`));
  });

  console.log('\nNow verify these counts match the Kanban UI via browser screenshot.');
}

main().catch(console.error);
