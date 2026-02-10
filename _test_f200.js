// Feature #200: Server-side validation matches client-side
// Test backend validation by bypassing frontend

const http = require('http');

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      var b = '';
      res.on('data', function(c) { b += c; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, body: b });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  var results = [];

  // 1. Login to get token
  console.log('=== Step 1: Login ===');
  var loginRes = await apiCall('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  var token = loginRes.body.token;
  console.log('Login status:', loginRes.status);
  console.log('Token obtained:', token ? 'YES' : 'NO');

  // 2. POST /api/transactions with negative amount (include date and type)
  console.log('\n=== Step 2: POST /api/transactions with negative amount ===');
  var negAmountRes = await apiCall('POST', '/api/transactions', {
    amount: -5000,
    type: 'ingreso',
    description: 'Test negative amount',
    category_id: 1,
    date: '2026-02-10'
  }, token);
  console.log('Status:', negAmountRes.status);
  console.log('Body:', JSON.stringify(negAmountRes.body));
  var pass2 = negAmountRes.status === 400;
  console.log('PASS:', pass2 ? 'YES' : 'NO');
  results.push({ test: 'Transaction negative amount', pass: pass2 });

  // 3. POST /api/transactions with zero amount
  console.log('\n=== Step 3: POST /api/transactions with zero amount ===');
  var zeroAmountRes = await apiCall('POST', '/api/transactions', {
    amount: 0,
    type: 'ingreso',
    description: 'Test zero amount',
    category_id: 1,
    date: '2026-02-10'
  }, token);
  console.log('Status:', zeroAmountRes.status);
  console.log('Body:', JSON.stringify(zeroAmountRes.body));
  var pass3 = zeroAmountRes.status === 400;
  console.log('PASS:', pass3 ? 'YES' : 'NO');
  results.push({ test: 'Transaction zero amount', pass: pass3 });

  // 4. POST /api/transactions with decimal amount
  console.log('\n=== Step 4: POST /api/transactions with decimal amount ===');
  var decimalAmountRes = await apiCall('POST', '/api/transactions', {
    amount: 100.5,
    type: 'ingreso',
    description: 'Test decimal amount',
    category_id: 1,
    date: '2026-02-10'
  }, token);
  console.log('Status:', decimalAmountRes.status);
  console.log('Body:', JSON.stringify(decimalAmountRes.body));
  var pass4 = decimalAmountRes.status === 400;
  console.log('PASS:', pass4 ? 'YES' : 'NO');
  results.push({ test: 'Transaction decimal amount', pass: pass4 });

  // 5. POST /api/payment-requests with empty description
  console.log('\n=== Step 5: POST /api/payment-requests with empty description ===');
  var emptyDescRes = await apiCall('POST', '/api/payment-requests', {
    amount: 10000,
    description: '',
    beneficiary: 'Test Vendor',
    category_id: 1
  }, token);
  console.log('Status:', emptyDescRes.status);
  console.log('Body:', JSON.stringify(emptyDescRes.body));
  var pass5 = emptyDescRes.status === 400 && emptyDescRes.body.fields && emptyDescRes.body.fields.description;
  console.log('PASS:', pass5 ? 'YES' : 'NO');
  results.push({ test: 'Payment request empty description', pass: pass5 });

  // 6. POST /api/payment-requests with empty beneficiary
  console.log('\n=== Step 6: POST /api/payment-requests with empty beneficiary ===');
  var emptyBenefRes = await apiCall('POST', '/api/payment-requests', {
    amount: 10000,
    description: 'Test description',
    beneficiary: '',
    category_id: 1
  }, token);
  console.log('Status:', emptyBenefRes.status);
  console.log('Body:', JSON.stringify(emptyBenefRes.body));
  var pass6 = emptyBenefRes.status === 400 && emptyBenefRes.body.fields && emptyBenefRes.body.fields.beneficiary;
  console.log('PASS:', pass6 ? 'YES' : 'NO');
  results.push({ test: 'Payment request empty beneficiary', pass: pass6 });

  // 7. POST /api/payment-requests with negative amount (include all required fields)
  console.log('\n=== Step 7: POST /api/payment-requests with negative amount ===');
  var negPrAmountRes = await apiCall('POST', '/api/payment-requests', {
    amount: -5000,
    description: 'Test negative',
    beneficiary: 'Test Vendor',
    category_id: 1
  }, token);
  console.log('Status:', negPrAmountRes.status);
  console.log('Body:', JSON.stringify(negPrAmountRes.body));
  var pass7 = negPrAmountRes.status === 400;
  console.log('PASS:', pass7 ? 'YES' : 'NO');
  results.push({ test: 'Payment request negative amount', pass: pass7 });

  // 8. POST /api/payment-requests with decimal amount
  console.log('\n=== Step 8: POST /api/payment-requests with decimal amount ===');
  var decPrAmountRes = await apiCall('POST', '/api/payment-requests', {
    amount: 100.5,
    description: 'Test decimal',
    beneficiary: 'Test Vendor',
    category_id: 1
  }, token);
  console.log('Status:', decPrAmountRes.status);
  console.log('Body:', JSON.stringify(decPrAmountRes.body));
  var pass8 = decPrAmountRes.status === 400;
  console.log('PASS:', pass8 ? 'YES' : 'NO');
  results.push({ test: 'Payment request decimal amount', pass: pass8 });

  // 9. Find a pendiente payment request to test reject without comment
  console.log('\n=== Step 9: POST /api/payment-requests/:id/reject without comment ===');
  var prListRes = await apiCall('GET', '/api/payment-requests?status=pendiente&limit=1', null, token);
  console.log('PR list status:', prListRes.status);

  var pendienteId = null;
  if (prListRes.body && prListRes.body.data && prListRes.body.data.length > 0) {
    pendienteId = prListRes.body.data[0].id;
  } else if (prListRes.body && Array.isArray(prListRes.body) && prListRes.body.length > 0) {
    pendienteId = prListRes.body[0].id;
  }
  console.log('Pendiente request ID:', pendienteId);

  if (pendienteId) {
    // Test reject with no comment at all
    var rejectNoCommentRes = await apiCall('POST', '/api/payment-requests/' + pendienteId + '/reject', {}, token);
    console.log('No comment - Status:', rejectNoCommentRes.status);
    console.log('No comment - Body:', JSON.stringify(rejectNoCommentRes.body));
    var pass9a = rejectNoCommentRes.status === 400;
    console.log('PASS:', pass9a ? 'YES' : 'NO');
    results.push({ test: 'Reject without comment', pass: pass9a });

    // Test reject with empty string comment
    var rejectEmptyCommentRes = await apiCall('POST', '/api/payment-requests/' + pendienteId + '/reject', { comment: '' }, token);
    console.log('\nEmpty comment - Status:', rejectEmptyCommentRes.status);
    console.log('Empty comment - Body:', JSON.stringify(rejectEmptyCommentRes.body));
    var pass9b = rejectEmptyCommentRes.status === 400;
    console.log('PASS:', pass9b ? 'YES' : 'NO');
    results.push({ test: 'Reject with empty comment', pass: pass9b });

    // Test reject with whitespace-only comment
    var rejectSpaceCommentRes = await apiCall('POST', '/api/payment-requests/' + pendienteId + '/reject', { comment: '   ' }, token);
    console.log('\nWhitespace comment - Status:', rejectSpaceCommentRes.status);
    console.log('Whitespace comment - Body:', JSON.stringify(rejectSpaceCommentRes.body));
    var pass9c = rejectSpaceCommentRes.status === 400;
    console.log('PASS:', pass9c ? 'YES' : 'NO');
    results.push({ test: 'Reject with whitespace comment', pass: pass9c });
  } else {
    console.log('No pendiente requests found - creating one for test');
    // Create a payment request as pendiente
    var createRes = await apiCall('POST', '/api/payment-requests', {
      amount: 1000,
      description: 'F200_REJECT_TEST',
      beneficiary: 'F200 Test Vendor',
      category_id: 1,
      status: 'pendiente'
    }, token);
    console.log('Created PR:', createRes.status, createRes.body.id);
    pendienteId = createRes.body.id;

    if (pendienteId) {
      var rejectNoCommentRes2 = await apiCall('POST', '/api/payment-requests/' + pendienteId + '/reject', {}, token);
      console.log('No comment - Status:', rejectNoCommentRes2.status);
      console.log('No comment - Body:', JSON.stringify(rejectNoCommentRes2.body));
      var pass9a2 = rejectNoCommentRes2.status === 400;
      console.log('PASS:', pass9a2 ? 'YES' : 'NO');
      results.push({ test: 'Reject without comment', pass: pass9a2 });

      var rejectEmptyCommentRes2 = await apiCall('POST', '/api/payment-requests/' + pendienteId + '/reject', { comment: '' }, token);
      console.log('\nEmpty comment - Status:', rejectEmptyCommentRes2.status);
      console.log('Empty comment - Body:', JSON.stringify(rejectEmptyCommentRes2.body));
      var pass9b2 = rejectEmptyCommentRes2.status === 400;
      console.log('PASS:', pass9b2 ? 'YES' : 'NO');
      results.push({ test: 'Reject with empty comment', pass: pass9b2 });
    }
  }

  // Summary
  console.log('\n\n========= SUMMARY =========');
  var allPass = true;
  for (var i = 0; i < results.length; i++) {
    console.log((results[i].pass ? '✅' : '❌') + ' ' + results[i].test);
    if (!results[i].pass) allPass = false;
  }
  console.log('\nALL TESTS PASS:', allPass ? 'YES' : 'NO');
}

main().catch(console.error);
