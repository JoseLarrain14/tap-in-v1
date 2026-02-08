const http = require('http');

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
      // NO Authorization header
    };

    const req = http.request(options, (res) => {
      var data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);

    if (method === 'POST') {
      req.write(JSON.stringify({ type: 'ingreso', amount: 1000, date: '2026-01-01' }));
    }

    req.end();
  });
}

async function testFeature15() {
  var results = [];

  function log(step, pass, detail) {
    results.push({ step: step, pass: pass, detail: detail });
    console.log((pass ? 'PASS' : 'FAIL') + ': ' + step + (detail ? ' - ' + detail : ''));
  }

  // Step 1: GET /api/transactions without Authorization header -> 401
  var res = await makeRequest('GET', '/api/transactions');
  log('GET /api/transactions without auth -> 401', res.status === 401, 'Status: ' + res.status);

  // Step 2: GET /api/payment-requests without Authorization header -> 401
  res = await makeRequest('GET', '/api/payment-requests');
  log('GET /api/payment-requests without auth -> 401', res.status === 401, 'Status: ' + res.status);

  // Step 3: GET /api/dashboard/summary without Authorization header -> 401
  res = await makeRequest('GET', '/api/dashboard/summary');
  log('GET /api/dashboard/summary without auth -> 401', res.status === 401, 'Status: ' + res.status);

  // Step 4: POST /api/transactions without Authorization header -> 401
  res = await makeRequest('POST', '/api/transactions');
  log('POST /api/transactions without auth -> 401', res.status === 401, 'Status: ' + res.status);

  // Extra: test with invalid token
  var invalidRes = await new Promise((resolve, reject) => {
    var options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/transactions',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-12345'
      }
    };
    var req = http.request(options, (response) => {
      var data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => { resolve({ status: response.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.end();
  });
  log('GET /api/transactions with invalid token -> 401', invalidRes.status === 401, 'Status: ' + invalidRes.status);

  // Extra: test more endpoints
  res = await makeRequest('GET', '/api/users');
  log('GET /api/users without auth -> 401', res.status === 401, 'Status: ' + res.status);

  res = await makeRequest('GET', '/api/categories');
  log('GET /api/categories without auth -> 401', res.status === 401, 'Status: ' + res.status);

  res = await makeRequest('GET', '/api/dashboard/chart');
  log('GET /api/dashboard/chart without auth -> 401', res.status === 401, 'Status: ' + res.status);

  res = await makeRequest('GET', '/api/dashboard/categories');
  log('GET /api/dashboard/categories without auth -> 401', res.status === 401, 'Status: ' + res.status);

  // Summary
  var allPass = results.every(function(r) { return r.pass; });
  console.log('\n=== FEATURE #15 SUMMARY ===');
  console.log('Total steps: ' + results.length);
  console.log('Passing: ' + results.filter(function(r) { return r.pass; }).length);
  console.log('Failing: ' + results.filter(function(r) { return !r.pass; }).length);
  console.log('Overall: ' + (allPass ? 'PASS' : 'FAIL'));

  process.exit(allPass ? 0 : 1);
}

testFeature15();
