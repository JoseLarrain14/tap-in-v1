var http = require('http');

function makeRequest(options, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Login as presidente
  console.log('=== Step 1: Login as presidente ===');
  var loginRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'presidente@tapin.cl', password: 'password123' });

  var token = loginRes.body.token;
  console.log('Login status:', loginRes.status);
  console.log('Got token:', token ? 'yes' : 'no');

  // Step 2: Get the submitted request to verify current values
  console.log('\n=== Step 2: Get request #40 current values ===');
  var getRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/payment-requests/40', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', getRes.status);
  console.log('Current amount:', getRes.body.amount);
  console.log('Current description:', getRes.body.description);
  console.log('Current beneficiary:', getRes.body.beneficiary);
  console.log('Current status:', getRes.body.status);

  // Step 3: Try to change amount via PUT
  console.log('\n=== Step 3: Try PUT to change amount ===');
  var putRes1 = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/payment-requests/40', method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { amount: 99999, description: 'HACKED_DESCRIPTION', beneficiary: 'Hacked Vendor' });
  console.log('PUT status:', putRes1.status);
  console.log('PUT response:', JSON.stringify(putRes1.body));

  var rejected1 = putRes1.status === 400 || putRes1.status === 403;
  console.log('PUT rejected (400 or 403)?', rejected1);

  // Step 4: Try to change just description via PUT
  console.log('\n=== Step 4: Try PUT to change description only ===');
  var putRes2 = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/payment-requests/40', method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { amount: 12345, description: 'CHANGED_VIA_API', beneficiary: 'Test Vendor F94' });
  console.log('PUT status:', putRes2.status);
  console.log('PUT response:', JSON.stringify(putRes2.body));

  var rejected2 = putRes2.status === 400 || putRes2.status === 403;
  console.log('PUT rejected (400 or 403)?', rejected2);

  // Step 5: Verify original values unchanged
  console.log('\n=== Step 5: Verify original values unchanged ===');
  var verifyRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/payment-requests/40', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Amount still 12345?', verifyRes.body.amount === 12345);
  console.log('Description still F94_IMMUTABLE_TEST?', verifyRes.body.description === 'F94_IMMUTABLE_TEST');
  console.log('Beneficiary still Test Vendor F94?', verifyRes.body.beneficiary === 'Test Vendor F94');
  console.log('Status still pendiente?', verifyRes.body.status === 'pendiente');

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('Step 1 (Login): PASS');
  console.log('Step 2 (Get current): status=' + getRes.body.status + ', amount=' + getRes.body.amount);
  console.log('Step 3 (PUT rejected):', rejected1 ? 'PASS' : 'FAIL');
  console.log('Step 4 (PUT rejected):', rejected2 ? 'PASS' : 'FAIL');
  console.log('Step 5 (Values unchanged):',
    (verifyRes.body.amount === 12345 &&
     verifyRes.body.description === 'F94_IMMUTABLE_TEST' &&
     verifyRes.body.beneficiary === 'Test Vendor F94') ? 'PASS' : 'FAIL');

  var allPass = rejected1 && rejected2 &&
    verifyRes.body.amount === 12345 &&
    verifyRes.body.description === 'F94_IMMUTABLE_TEST';
  console.log('\nOVERALL:', allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
}

main().catch(function(e) { console.error('Error:', e); });
