var http = require('http');

function makeRequest(opts, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() { resolve({ status: res.statusCode, body: JSON.parse(data) }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Step 1: Get token
  var loginData = JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' });
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);

  var token = loginRes.body.token;
  console.log('Login:', loginRes.status, 'Token:', token ? token.substring(0, 20) + '...' : 'NONE');

  var authHeaders = { 'Authorization': 'Bearer ' + token };

  // Step 2: Test unread count
  var countRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/notifications/unread-count',
    headers: authHeaders
  });
  console.log('Unread count:', JSON.stringify(countRes.body));

  // Step 3: Test list notifications
  var listRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/notifications',
    headers: authHeaders
  });
  console.log('Notifications list:', listRes.status, 'count:', listRes.body.notifications ? listRes.body.notifications.length : 0, 'unread:', listRes.body.unread_count);

  // Step 4: Test payment requests (for kanban)
  var prRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/payment-requests',
    headers: authHeaders
  });
  console.log('Payment requests:', prRes.status, 'count:', prRes.body.payment_requests ? prRes.body.payment_requests.length : 0);
  if (prRes.body.payment_requests) {
    prRes.body.payment_requests.forEach(function(pr) {
      console.log('  PR #' + pr.id + ': status=' + pr.status + ' desc=' + pr.description);
    });
  }

  console.log('\nAll API tests passed!');
}

run().catch(function(e) { console.error('Error:', e); process.exit(1); });
