const http = require('http');
const fs = require('fs');
const path = require('path');

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login(email, password) {
  const res = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email, password }));
  return res.body.token;
}

async function get(path, token) {
  const res = await httpReq({
    hostname: 'localhost', port: 3001, path,
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  return res;
}

async function main() {
  // Step 1: Login as presidente and create a new payment request for 50000
  const presToken = await login('presidente@tapin.cl', 'password123');
  process.stdout.write('1. Presidente logged in\n');

  // Create a new payment request for exactly 50000
  const createRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/payment-requests',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + presToken }
  }, JSON.stringify({
    amount: 50000,
    description: 'F125_EXECUTE_TEST',
    beneficiary: 'Test Vendor F125',
    category_id: 1
  }));
  process.stdout.write('2. Created payment request: #' + createRes.body.id + ' status=' + createRes.body.status + '\n');
  const prId = createRes.body.id;

  // Submit it (change from borrador to pendiente)
  const submitRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/payment-requests/' + prId + '/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + presToken }
  }, JSON.stringify({}));
  process.stdout.write('3. Submitted: status=' + (submitRes.body.status || submitRes.status) + '\n');

  // Approve it as presidente
  const approveRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/payment-requests/' + prId + '/approve',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + presToken }
  }, JSON.stringify({}));
  process.stdout.write('4. Approved: status=' + (approveRes.body.status || approveRes.status) + '\n');

  // Verify it's now approved
  const checkRes = await get('/api/payment-requests/' + prId, presToken);
  process.stdout.write('5. PR status after approval: ' + checkRes.body.status + ', amount: ' + checkRes.body.amount + '\n');

  // Get dashboard before execution
  const dashBefore = await get('/api/dashboard/summary', presToken);
  process.stdout.write('6. Dashboard balance BEFORE: ' + dashBefore.body.balance + '\n');

  // Step 2: Login as secretaria and execute
  const secToken = await login('secretaria@tapin.cl', 'password123');
  process.stdout.write('7. Secretaria logged in\n');

  // Execute with a dummy comprobante file
  // Create a simple test image
  const boundary = '----FormBoundary' + Date.now();
  const fileContent = Buffer.from('fake-pdf-content-for-testing');
  let formBody = '';
  formBody += '--' + boundary + '\r\n';
  formBody += 'Content-Disposition: form-data; name="comprobante"; filename="comprobante_test.pdf"\r\n';
  formBody += 'Content-Type: application/pdf\r\n\r\n';
  const bodyStart = Buffer.from(formBody);
  const bodyEnd = Buffer.from('\r\n--' + boundary + '--\r\n');
  const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

  const execRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/payment-requests/' + prId + '/execute',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secToken,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
  process.stdout.write('8. Execute result: HTTP ' + execRes.status + ' - ' + JSON.stringify(execRes.body).substring(0, 200) + '\n');

  // Step 3: Verify PR is now ejecutado
  const checkAfter = await get('/api/payment-requests/' + prId, presToken);
  process.stdout.write('9. PR status after execution: ' + checkAfter.body.status + '\n');
  process.stdout.write('   PR transaction_id: ' + checkAfter.body.transaction_id + '\n');

  // Step 4: Verify transaction was created
  const txRes = await get('/api/transactions?limit=100', presToken);
  const matchingTx = txRes.body.transactions.filter(t => t.description === 'F125_EXECUTE_TEST');
  process.stdout.write('10. Matching transactions found: ' + matchingTx.length + '\n');
  if (matchingTx.length > 0) {
    const tx = matchingTx[0];
    process.stdout.write('    Transaction ID: ' + tx.id + '\n');
    process.stdout.write('    Type: ' + tx.type + ' (expected: egreso)\n');
    process.stdout.write('    Amount: ' + tx.amount + ' (expected: 50000)\n');
    process.stdout.write('    Source: ' + tx.source + '\n');
    process.stdout.write('    Beneficiary: ' + tx.beneficiary + '\n');
  }

  // Step 5: Verify dashboard balance reflects the expense
  const dashAfter = await get('/api/dashboard/summary', presToken);
  process.stdout.write('11. Dashboard balance AFTER: ' + dashAfter.body.balance + '\n');
  process.stdout.write('    Balance change: ' + (dashAfter.body.balance - dashBefore.body.balance) + ' (expected: -50000)\n');

  process.stdout.write('\n=== VERIFICATION SUMMARY ===\n');
  const prOk = checkAfter.body.status === 'ejecutado';
  const txOk = matchingTx.length > 0 && matchingTx[0].type === 'egreso' && matchingTx[0].amount === 50000;
  const balOk = (dashAfter.body.balance - dashBefore.body.balance) === -50000;
  process.stdout.write('PR status ejecutado: ' + (prOk ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Transaction created (egreso, 50000): ' + (txOk ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Dashboard balance decreased by 50000: ' + (balOk ? 'PASS' : 'FAIL') + '\n');
}

main().catch(e => process.stdout.write('ERROR: ' + e.message + '\n'));
