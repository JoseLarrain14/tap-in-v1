const http = require('http');

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const login = await api('POST', '/api/auth/login', { email: 'delegado@tapin.cl', password: 'password123' });
  const token = login.data.token;

  // Check transaction 41 directly
  const txRes = await api('GET', '/api/transactions/41', null, token);
  process.stdout.write('Transaction response: ' + JSON.stringify(txRes.data, null, 2) + '\n');

  // Also check all transactions to find our one
  const allTx = await api('GET', '/api/transactions?limit=5&sort_by=created_at&sort_order=desc', null, token);
  process.stdout.write('\nRecent transactions:\n');
  const txs = allTx.data.transactions || allTx.data;
  if (Array.isArray(txs)) {
    txs.forEach(t => {
      process.stdout.write('  ID:' + t.id + ' type:' + t.type + ' amount:' + t.amount + ' desc:' + t.description + ' source:' + t.source + '\n');
    });
  } else {
    process.stdout.write(JSON.stringify(allTx.data, null, 2) + '\n');
  }
}

main().catch(e => process.stderr.write(e.message + '\n'));
