const http = require('http');

function request(method, path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { hostname: 'localhost', port: 3001, path, method, headers };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function requestPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const login = await requestPost('/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const token = login.data.token;

  const res = await request('GET', '/api/transactions?type=ingreso&search=F263_', token);
  const txs = Array.isArray(res.data) ? res.data : (res.data.transactions || []);

  console.log('After restart - F263 incomes found:', txs.length);
  for (const tx of txs) {
    console.log(' -', tx.description, '| created_by:', tx.created_by_name || tx.created_by, '| amount:', tx.amount);
  }

  if (txs.length === 3) {
    console.log('\nSUCCESS: All 3 F263 incomes persisted after server restart');
  } else {
    console.log('\nFAIL: Expected 3 F263 incomes, found', txs.length);
  }
}

main().catch(console.error);
