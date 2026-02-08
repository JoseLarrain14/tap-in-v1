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
  const TS = Date.now();

  // Step 1: Login as Delegado
  console.log('=== STEP 1: Login as Delegado ===');
  const delegadoLogin = await api('POST', '/api/auth/login', { email: 'delegado@tapin.cl', password: 'password123' });
  const delegadoToken = delegadoLogin.data.token;
  console.log('Delegado logged in:', delegadoLogin.status === 200 ? 'OK' : 'FAIL');

  // Step 2: Create draft payment request
  console.log('\n=== STEP 2: Create draft payment request ===');
  const createRes = await api('POST', '/api/payment-requests', {
    amount: 45000,
    description: 'FEAT76_E2E_' + TS,
    beneficiary: 'Proveedor E2E Test',
    category_id: 6,
    status: 'borrador'
  }, delegadoToken);
  const prId = createRes.data.id || createRes.data.paymentRequest?.id;
  console.log('Draft created:', createRes.status, 'ID:', prId);
  if (!prId) { console.log('ERROR:', JSON.stringify(createRes.data)); return; }

  // Step 3: Edit draft
  console.log('\n=== STEP 3: Edit draft ===');
  const editRes = await api('PUT', '/api/payment-requests/' + prId, {
    amount: 55000,
    description: 'FEAT76_E2E_EDITED_' + TS,
    beneficiary: 'Proveedor E2E Editado'
  }, delegadoToken);
  console.log('Draft edited:', editRes.status === 200 ? 'OK' : 'FAIL', editRes.status);

  // Verify edit
  const afterEdit = await api('GET', '/api/payment-requests/' + prId, null, delegadoToken);
  const pr = afterEdit.data.paymentRequest || afterEdit.data;
  console.log('After edit - amount:', pr.amount, 'desc:', pr.description, 'status:', pr.status);

  // Step 4: Submit draft
  console.log('\n=== STEP 4: Submit draft ===');
  const submitRes = await api('POST', '/api/payment-requests/' + prId + '/submit', {}, delegadoToken);
  console.log('Submit:', submitRes.status === 200 ? 'OK' : 'FAIL', submitRes.status);

  // Step 5: Verify immutability
  console.log('\n=== STEP 5: Verify immutability ===');
  const editAfterSubmit = await api('PUT', '/api/payment-requests/' + prId, {
    amount: 99999, description: 'SHOULD_NOT_WORK'
  }, delegadoToken);
  console.log('Edit after submit:', editAfterSubmit.status === 400 || editAfterSubmit.status === 403 ? 'CORRECTLY BLOCKED (' + editAfterSubmit.status + ')' : 'ERROR (' + editAfterSubmit.status + ')');

  // Step 6: Login as Presidente, approve
  console.log('\n=== STEP 6: Presidente approve ===');
  const presLogin = await api('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const presToken = presLogin.data.token;
  const approveRes = await api('POST', '/api/payment-requests/' + prId + '/approve', {
    comment: 'Aprobado E2E test'
  }, presToken);
  console.log('Approve:', approveRes.status === 200 ? 'OK' : 'FAIL', approveRes.status);

  // Step 7: Login as Secretaria, execute
  console.log('\n=== STEP 7: Secretaria execute ===');
  const secLogin = await api('POST', '/api/auth/login', { email: 'secretaria@tapin.cl', password: 'password123' });
  const secToken = secLogin.data.token;

  const boundary = '----FormBoundary' + TS;
  const fileContent = 'Comprobante E2E test PDF simulado';
  const formBody = [
    '--' + boundary,
    'Content-Disposition: form-data; name="comment"',
    '',
    'Pago ejecutado via transferencia',
    '--' + boundary,
    'Content-Disposition: form-data; name="comprobante"; filename="comprobante-e2e.pdf"',
    'Content-Type: application/pdf',
    '',
    fileContent,
    '--' + boundary + '--'
  ].join('\r\n');

  const executeRes = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path: '/api/payment-requests/' + prId + '/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Authorization': 'Bearer ' + secToken,
        'Content-Length': Buffer.byteLength(formBody)
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    req.write(formBody);
    req.end();
  });
  console.log('Execute:', executeRes.status === 200 ? 'OK' : 'FAIL', executeRes.status);
  if (executeRes.status !== 200) console.log('Execute error:', JSON.stringify(executeRes.data));

  // Step 8: Verify final status
  console.log('\n=== STEP 8: Final status ===');
  const finalRes = await api('GET', '/api/payment-requests/' + prId, null, delegadoToken);
  const finalPR = finalRes.data.paymentRequest || finalRes.data;
  console.log('Status:', finalPR.status);
  console.log('Approved by:', finalPR.approved_by);
  console.log('Executed by:', finalPR.executed_by);
  console.log('Transaction ID:', finalPR.transaction_id);

  // Step 9: Verify transaction
  console.log('\n=== STEP 9: Transaction record ===');
  if (finalPR.transaction_id) {
    const txRes = await api('GET', '/api/transactions/' + finalPR.transaction_id, null, delegadoToken);
    const tx = txRes.data.transaction || txRes.data;
    console.log('Type:', tx.type, 'Amount:', tx.amount, 'Source:', tx.source);
    console.log('Description:', tx.description);
  } else {
    console.log('WARNING: No transaction_id');
  }

  // Step 10: Verify payment events
  console.log('\n=== STEP 10: Payment events ===');
  const events = finalRes.data.events || [];
  console.log('Total events:', events.length);
  events.forEach((ev, i) => {
    console.log('  ' + (i+1) + ':', ev.previous_status, '->', ev.new_status, '|', (ev.comment || '').substring(0, 60));
  });

  // Step 11: Verify notifications
  console.log('\n=== STEP 11: Notifications ===');
  const dNotifs = await api('GET', '/api/notifications?limit=50', null, delegadoToken);
  const dRel = (dNotifs.data.notifications || []).filter(n => n.reference_id === prId);
  console.log('Delegado notifications:', dRel.length);
  dRel.forEach(n => console.log('  -', n.type));

  const pNotifs = await api('GET', '/api/notifications?limit=50', null, presToken);
  const pRel = (pNotifs.data.notifications || []).filter(n => n.reference_id === prId);
  console.log('Presidente notifications:', pRel.length);
  pRel.forEach(n => console.log('  -', n.type));

  const sNotifs = await api('GET', '/api/notifications?limit=50', null, secToken);
  const sRel = (sNotifs.data.notifications || []).filter(n => n.reference_id === prId);
  console.log('Secretaria notifications:', sRel.length);
  sRel.forEach(n => console.log('  -', n.type));

  // Step 12: Attachments
  console.log('\n=== STEP 12: Attachments ===');
  const attachments = finalRes.data.attachments || [];
  console.log('Count:', attachments.length);
  attachments.forEach(a => console.log('  -', a.attachment_type, ':', a.file_name));

  // Summary
  console.log('\n========== SUMMARY ==========');
  console.log('PR ID:', prId);
  console.log('Final status:', finalPR.status, finalPR.status === 'ejecutado' ? 'PASS' : 'FAIL');
  console.log('Events:', events.length, events.length >= 4 ? 'PASS' : 'FAIL');
  console.log('Has transaction:', !!finalPR.transaction_id ? 'PASS' : 'FAIL');
  console.log('Immutability:', editAfterSubmit.status === 400 || editAfterSubmit.status === 403 ? 'PASS' : 'FAIL');
  console.log('Delegado notified:', dRel.length >= 2 ? 'PASS' : 'FAIL (' + dRel.length + ')');
  console.log('Presidente notified:', pRel.length >= 1 ? 'PASS' : 'FAIL (' + pRel.length + ')');
  console.log('Secretaria notified:', sRel.length >= 1 ? 'PASS' : 'FAIL (' + sRel.length + ')');
}

main().catch(console.error);
