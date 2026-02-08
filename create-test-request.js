var http = require('http');

function makeRequest(options, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(JSON.parse(data)); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get token
  var authResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'presidente@tapin.cl', password: 'password123' });

  var token = authResult.token;
  console.log('Got token');

  // Create payment request
  var result = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/payment-requests',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  }, {
    amount: 50000,
    description: 'TEST_F39_Compra materiales',
    beneficiary: 'Proveedor XYZ',
    status: 'pendiente'
  });

  console.log('Created payment request:', JSON.stringify(result, null, 2));
}

main().catch(function(err) { console.error(err); });
