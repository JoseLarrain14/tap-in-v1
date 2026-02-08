const http = require('http');

function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'test-feature28' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function findReqByDesc(desc, token) {
  const list = await makeRequest('GET', '/api/payment-requests?search=' + encodeURIComponent(desc), null, token);
  const reqs = list.body.payment_requests || [];
  return reqs.find(r => r.description === desc);
}

async function run() {
  console.log('=== Feature #28: Secretaria cannot execute unapproved payment request ===\n');

  // Login
  const presLogin = await makeRequest('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const presToken = presLogin.body.token;
  console.log('1. Presidente login:', presLogin.status === 200 ? 'OK' : 'FAIL');

  const secLogin = await makeRequest('POST', '/api/auth/login', { email: 'secretaria@tapin.cl', password: 'password123' });
  const secToken = secLogin.body.token;
  console.log('2. Secretaria login:', secLogin.status === 200 ? 'OK' : 'FAIL');

  // Create pendiente request (with User-Agent header to avoid 500)
  const createPend = await makeRequest('POST', '/api/payment-requests', {
    amount: 50000, description: 'F28_PEND_UNIQUE', beneficiary: 'Vendor Pendiente', status: 'pendiente'
  }, presToken);
  console.log('3. Create pendiente - status:', createPend.status);

  // Find it by search
  const pendReq = await findReqByDesc('F28_PEND_UNIQUE', presToken);
  console.log('   Found pendiente: #' + (pendReq ? pendReq.id : 'NOT FOUND') + ' status:', pendReq ? pendReq.status : 'N/A');

  // Create borrador request
  const createBorr = await makeRequest('POST', '/api/payment-requests', {
    amount: 30000, description: 'F28_BORR_UNIQUE', beneficiary: 'Vendor Borrador'
  }, presToken);
  console.log('4. Create borrador - status:', createBorr.status);

  const borrReq = await findReqByDesc('F28_BORR_UNIQUE', presToken);
  console.log('   Found borrador: #' + (borrReq ? borrReq.id : 'NOT FOUND') + ' status:', borrReq ? borrReq.status : 'N/A');

  if (!pendReq || !borrReq) {
    console.log('\nFAIL: Could not find test requests');
    return;
  }

  // TEST A: Secretaria execute pendiente -> 400
  const execPend = await makeRequest('POST', '/api/payment-requests/' + pendReq.id + '/execute', {}, secToken);
  console.log('\n--- TEST A: Execute pendiente #' + pendReq.id + ' ---');
  console.log('   Status:', execPend.status, '(expect 400) Error:', execPend.body.error);
  const testA = execPend.status === 400;
  console.log('   RESULT:', testA ? 'PASS' : 'FAIL');

  // TEST B: Secretaria execute borrador -> 400
  const execBorr = await makeRequest('POST', '/api/payment-requests/' + borrReq.id + '/execute', {}, secToken);
  console.log('\n--- TEST B: Execute borrador #' + borrReq.id + ' ---');
  console.log('   Status:', execBorr.status, '(expect 400) Error:', execBorr.body.error);
  const testB = execBorr.status === 400;
  console.log('   RESULT:', testB ? 'PASS' : 'FAIL');

  // Approve the pendiente request
  const approve = await makeRequest('POST', '/api/payment-requests/' + pendReq.id + '/approve', {}, presToken);
  console.log('\n5. Approved #' + pendReq.id + ': status', approve.status, approve.body.status);

  // TEST C: Secretaria execute approved -> 200
  const execAppr = await makeRequest('POST', '/api/payment-requests/' + pendReq.id + '/execute', {}, secToken);
  console.log('\n--- TEST C: Execute approved #' + pendReq.id + ' ---');
  console.log('   Status:', execAppr.status, '(expect 200) New status:', execAppr.body.status);
  const testC = execAppr.status === 200 && execAppr.body.status === 'ejecutado';
  console.log('   RESULT:', testC ? 'PASS' : 'FAIL');

  // Create and reject a request
  await makeRequest('POST', '/api/payment-requests', {
    amount: 20000, description: 'F28_RECH_UNIQUE', beneficiary: 'Vendor Rechazado', status: 'pendiente'
  }, presToken);
  const rechReq = await findReqByDesc('F28_RECH_UNIQUE', presToken);
  let testD = false;
  if (rechReq) {
    await makeRequest('POST', '/api/payment-requests/' + rechReq.id + '/reject', { comment: 'Test rejection for f28' }, presToken);

    const execRech = await makeRequest('POST', '/api/payment-requests/' + rechReq.id + '/execute', {}, secToken);
    console.log('\n--- TEST D: Execute rechazado #' + rechReq.id + ' ---');
    console.log('   Status:', execRech.status, '(expect 400) Error:', execRech.body.error);
    testD = execRech.status === 400;
    console.log('   RESULT:', testD ? 'PASS' : 'FAIL');
  } else {
    console.log('\nTEST D: SKIP (could not create)');
  }

  const allPass = testA && testB && testC && testD;
  console.log('\n=== OVERALL:', allPass ? 'ALL PASS' : 'SOME FAILED', '===');
}

run().catch(console.error);
