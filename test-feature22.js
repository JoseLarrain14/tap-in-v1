const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-feature22');

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function apiRequest(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function writeResult(filename, content) {
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, filename), JSON.stringify(content, null, 2));
}

async function main() {
  const results = {};

  // Step 1: Login as presidente
  console.log('=== Step 1: Login as presidente ===');
  const presLogin = await apiRequest('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  console.log('Login status:', presLogin.status);
  console.log('User:', presLogin.body.user ? presLogin.body.user.name : 'N/A', '- Role:', presLogin.body.user ? presLogin.body.user.role : 'N/A');
  const presToken = presLogin.body.token;
  results.presidenteLogin = presLogin;

  // Step 2: Get users list
  console.log('\n=== Step 2: Get users list ===');
  const usersResponse = await apiRequest('GET', '/api/users', null, presToken);
  console.log('Users status:', usersResponse.status);
  // API returns { users: [...] }
  const usersList = usersResponse.body.users || usersResponse.body;
  if (Array.isArray(usersList)) {
    usersList.forEach(function(u) {
      console.log('  - ' + u.name + ' (' + u.email + ') - Role: ' + u.role + ' - Active: ' + u.is_active);
    });
  } else {
    console.log('Users response:', JSON.stringify(usersResponse.body));
  }
  results.usersList = usersResponse;
  writeResult('01-users-list.json', usersResponse);

  // Find delegado user
  var delegadoUser = null;
  if (Array.isArray(usersList)) {
    delegadoUser = usersList.find(function(u) { return u.role === 'delegado'; });
  }

  if (!delegadoUser) {
    console.log('ERROR: Could not find delegado user in list');
    console.log('Will try with ID 3 as fallback...');
  } else {
    console.log('\nDelegado user found:', delegadoUser.name, '- ID:', delegadoUser.id, '- Active:', delegadoUser.is_active);
  }

  // Step 3: Deactivate delegado user
  console.log('\n=== Step 3: Deactivate delegado user ===');
  var delegadoId = delegadoUser ? delegadoUser.id : 3;

  var deactivateResult = await apiRequest('PUT', '/api/users/' + delegadoId + '/deactivate', {}, presToken);
  console.log('Deactivate (PUT /api/users/' + delegadoId + '/deactivate) status:', deactivateResult.status);
  console.log('Deactivate response:', JSON.stringify(deactivateResult.body));

  results.deactivateResult = deactivateResult;
  writeResult('02-deactivate-result.json', deactivateResult);

  // Step 4: Verify user is deactivated
  console.log('\n=== Step 4: Verify user is now deactivated ===');
  var usersAfter = await apiRequest('GET', '/api/users', null, presToken);
  var usersAfterList = usersAfter.body.users || usersAfter.body;
  if (Array.isArray(usersAfterList)) {
    var updatedDelegado = usersAfterList.find(function(u) { return u.id === delegadoId; });
    if (updatedDelegado) {
      console.log('Delegado after deactivation:', updatedDelegado.name, '- Active:', updatedDelegado.is_active);
    }
  }
  results.usersAfterDeactivation = usersAfter;
  writeResult('03-users-after-deactivation.json', usersAfter);

  // Step 5: Login as deactivated delegado
  console.log('\n=== Step 5: Login as deactivated delegado ===');
  var delLogin = await apiRequest('POST', '/api/auth/login', {
    email: 'delegado@tapin.cl',
    password: 'password123'
  });
  console.log('Delegado login status:', delLogin.status);
  if (delLogin.body.user) {
    console.log('Delegado user:', delLogin.body.user.name, '- is_active:', delLogin.body.user.is_active);
  }
  console.log('Delegado got token:', delLogin.body.token ? 'YES' : 'NO');
  results.delegadoLogin = delLogin;
  writeResult('04-delegado-login.json', delLogin);

  // If login succeeded, test read/write access
  if (delLogin.body.token) {
    var delToken = delLogin.body.token;

    // Step 6: Verify READ access - Transactions
    console.log('\n=== Step 6: Verify READ access ===');
    var transactions = await apiRequest('GET', '/api/transactions', null, delToken);
    console.log('GET /api/transactions status:', transactions.status);
    if (transactions.body.transactions) {
      console.log('  Transactions count:', transactions.body.transactions.length);
    }
    results.readTransactions = { status: transactions.status };
    writeResult('05-read-transactions.json', { status: transactions.status, body: transactions.body });

    // Verify READ access - Payment requests (pipeline)
    var paymentRequests = await apiRequest('GET', '/api/payment-requests', null, delToken);
    console.log('GET /api/payment-requests status:', paymentRequests.status);
    if (paymentRequests.body.payment_requests) {
      console.log('  Payment requests count:', paymentRequests.body.payment_requests.length);
    }
    results.readPaymentRequests = { status: paymentRequests.status };
    writeResult('06-read-pipeline.json', { status: paymentRequests.status, body: paymentRequests.body });

    // Verify READ access - Auth me
    var authMe = await apiRequest('GET', '/api/auth/me', null, delToken);
    console.log('GET /api/auth/me status:', authMe.status);
    results.readAuthMe = { status: authMe.status };

    // Step 7: Verify WRITE access is blocked - Create transaction (ingreso)
    console.log('\n=== Step 7: Verify WRITE access is BLOCKED ===');
    var createTransaction = await apiRequest('POST', '/api/transactions', {
      type: 'ingreso',
      amount: 10000,
      description: 'Test ingreso from deactivated user',
      date: '2026-02-07'
    }, delToken);
    console.log('POST /api/transactions status:', createTransaction.status, '(expected 403)');
    console.log('Response:', JSON.stringify(createTransaction.body));
    results.writeTransaction = createTransaction;
    writeResult('07-write-transaction-blocked.json', createTransaction);

    // Step 8: Verify WRITE access is blocked - Create payment request (egreso)
    var createPaymentReq = await apiRequest('POST', '/api/payment-requests', {
      description: 'Test solicitud from deactivated user',
      amount: 5000,
      beneficiary: 'Test Beneficiario'
    }, delToken);
    console.log('POST /api/payment-requests status:', createPaymentReq.status, '(expected 403)');
    console.log('Response:', JSON.stringify(createPaymentReq.body));
    results.writePaymentRequest = createPaymentReq;
    writeResult('08-write-payment-request-blocked.json', createPaymentReq);

    // Step 9: Also verify GET /api/transactions still works (read access preserved)
    console.log('\n=== Step 8 (extra): Verify GET still works after write attempts ===');
    var readAgain = await apiRequest('GET', '/api/transactions', null, delToken);
    console.log('GET /api/transactions (again) status:', readAgain.status);
    results.readAgain = { status: readAgain.status };

  } else {
    console.log('\nDelegado login was blocked entirely (could not get token).');
    console.log('This means deactivated users cannot login at all.');
  }

  // Re-activate the user to restore the database state
  console.log('\n=== Cleanup: Re-activate delegado user ===');
  var reactivateResult = await apiRequest('PUT', '/api/users/' + delegadoId + '/activate', {}, presToken);
  console.log('Reactivate status:', reactivateResult.status);
  console.log('Reactivate response:', JSON.stringify(reactivateResult.body));
  results.reactivateResult = reactivateResult;

  // Summary
  console.log('\n========================================');
  console.log('=== FEATURE 22 TEST SUMMARY ===');
  console.log('========================================');
  console.log('1. Presidente login: ' + (presLogin.status === 200 ? 'PASS' : 'FAIL'));
  console.log('2. Users list retrieved: ' + (usersResponse.status === 200 ? 'PASS' : 'FAIL'));
  console.log('3. Deactivation endpoint: ' + (deactivateResult.status === 200 ? 'PASS' : 'FAIL') + ' (status: ' + deactivateResult.status + ')');

  if (delLogin.body.token) {
    var readTxOk = results.readTransactions && results.readTransactions.status === 200;
    var readPrOk = results.readPaymentRequests && results.readPaymentRequests.status === 200;
    var readOk = readTxOk && readPrOk;
    var writeTxBlocked = results.writeTransaction && results.writeTransaction.status === 403;
    var writePrBlocked = results.writePaymentRequest && results.writePaymentRequest.status === 403;
    var writeBlocked = writeTxBlocked && writePrBlocked;

    console.log('4. Deactivated user can login: PASS (login succeeded, can get token)');
    console.log('5. Deactivated user READ /api/transactions: ' + (readTxOk ? 'PASS (200)' : 'FAIL (' + (results.readTransactions ? results.readTransactions.status : 'N/A') + ')'));
    console.log('6. Deactivated user READ /api/payment-requests: ' + (readPrOk ? 'PASS (200)' : 'FAIL (' + (results.readPaymentRequests ? results.readPaymentRequests.status : 'N/A') + ')'));
    console.log('7. POST /api/transactions blocked: ' + (writeTxBlocked ? 'PASS (403)' : 'FAIL (status: ' + (results.writeTransaction ? results.writeTransaction.status : 'N/A') + ')'));
    console.log('8. POST /api/payment-requests blocked: ' + (writePrBlocked ? 'PASS (403)' : 'FAIL (status: ' + (results.writePaymentRequest ? results.writePaymentRequest.status : 'N/A') + ')'));
    console.log('9. Cleanup (re-activate): ' + (reactivateResult.status === 200 ? 'PASS' : 'FAIL'));
    console.log('\n=== OVERALL FEATURE 22: ' + (readOk && writeBlocked ? 'PASS' : 'FAIL') + ' ===');
  } else {
    console.log('4. Deactivated user login: BLOCKED (user cannot login at all)');
    console.log('   Feature 22 requires deactivated users to retain READ access.');
    console.log('   If login is blocked, read access is also blocked.');
    console.log('\n=== OVERALL FEATURE 22: FAIL (deactivated user should retain read access) ===');
  }

  writeResult('09-summary.json', {
    presidenteLoginOk: presLogin.status === 200,
    usersListOk: usersResponse.status === 200,
    deactivationOk: deactivateResult.status === 200,
    delegadoCanLogin: !!delLogin.body.token,
    readTransactionsOk: results.readTransactions ? results.readTransactions.status === 200 : false,
    readPaymentRequestsOk: results.readPaymentRequests ? results.readPaymentRequests.status === 200 : false,
    writeTransactionsBlocked: results.writeTransaction ? results.writeTransaction.status === 403 : false,
    writePaymentRequestsBlocked: results.writePaymentRequest ? results.writePaymentRequest.status === 403 : false,
    reactivationOk: reactivateResult.status === 200
  });
  console.log('\nAll results saved to:', SCREENSHOTS_DIR);
}

main().catch(function(err) {
  console.error('Test failed with error:', err.message);
  process.exit(1);
});
