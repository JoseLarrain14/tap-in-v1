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
  process.stdout.write('=== STEP 1: Login as Delegado ===\n');
  const login = await api('POST', '/api/auth/login', { email: 'delegado@tapin.cl', password: 'password123' });
  const token = login.data.token;
  process.stdout.write('Login: ' + (login.status === 200 ? 'OK' : 'FAIL') + '\n');

  // Step 2: Create income with all fields
  process.stdout.write('\n=== STEP 2: Create income ===\n');
  const createRes = await api('POST', '/api/transactions', {
    type: 'ingreso',
    amount: 125000,
    description: 'FEAT77_INCOME_' + TS,
    category_id: 1,
    date: '2026-02-08',
    payer_name: 'Apoderado Test F77',
    payer_rut: '12.345.678-9'
  }, token);
  process.stdout.write('Create status: ' + createRes.status + '\n');
  const txId = createRes.data.id || createRes.data.transaction?.id;
  process.stdout.write('Transaction ID: ' + txId + '\n');
  if (!txId) {
    process.stdout.write('ERROR: ' + JSON.stringify(createRes.data) + '\n');
    return;
  }

  // Step 3: Verify income in list (Read)
  process.stdout.write('\n=== STEP 3: Verify in list ===\n');
  const listRes = await api('GET', '/api/transactions?type=ingreso&limit=50', null, token);
  const txs = listRes.data.transactions || listRes.data;
  const found = Array.isArray(txs) ? txs.find(t => t.id === txId) : null;
  process.stdout.write('Found in list: ' + (found ? 'YES' : 'NO') + '\n');
  if (found) {
    process.stdout.write('  Amount: ' + found.amount + '\n');
    process.stdout.write('  Description: ' + found.description + '\n');
    process.stdout.write('  Payer: ' + found.payer_name + '\n');
    process.stdout.write('  Type: ' + found.type + '\n');
  }

  // Step 4: Edit income - change amount and description
  process.stdout.write('\n=== STEP 4: Edit income ===\n');
  const editRes = await api('PUT', '/api/transactions/' + txId, {
    amount: 150000,
    description: 'FEAT77_INCOME_EDITED_' + TS,
    payer_name: 'Apoderado Editado F77'
  }, token);
  process.stdout.write('Edit status: ' + editRes.status + ' ' + (editRes.status === 200 ? 'OK' : 'FAIL') + '\n');

  // Step 5: Verify edit metadata
  process.stdout.write('\n=== STEP 5: Verify edit metadata ===\n');
  const afterEdit = await api('GET', '/api/transactions?type=ingreso&limit=50', null, token);
  const txsAfter = afterEdit.data.transactions || afterEdit.data;
  const edited = Array.isArray(txsAfter) ? txsAfter.find(t => t.id === txId) : null;
  if (edited) {
    process.stdout.write('  Amount after edit: ' + edited.amount + '\n');
    process.stdout.write('  Description after edit: ' + edited.description + '\n');
    process.stdout.write('  Payer after edit: ' + edited.payer_name + '\n');
    process.stdout.write('  edited_by: ' + edited.edited_by + '\n');
    process.stdout.write('  edited_at: ' + edited.edited_at + '\n');
  } else {
    process.stdout.write('  NOT FOUND after edit!\n');
  }

  // Step 6: Delete income
  process.stdout.write('\n=== STEP 6: Delete income ===\n');
  const deleteRes = await api('DELETE', '/api/transactions/' + txId, null, token);
  process.stdout.write('Delete status: ' + deleteRes.status + ' ' + (deleteRes.status === 200 ? 'OK' : 'FAIL') + '\n');

  // Step 7: Verify income no longer in list
  process.stdout.write('\n=== STEP 7: Verify not in list ===\n');
  const afterDelete = await api('GET', '/api/transactions?type=ingreso&limit=50', null, token);
  const txsDeleted = afterDelete.data.transactions || afterDelete.data;
  const stillExists = Array.isArray(txsDeleted) ? txsDeleted.find(t => t.id === txId) : null;
  process.stdout.write('Still in list: ' + (stillExists ? 'YES - FAIL' : 'NO - PASS (correctly removed)') + '\n');

  // Step 8: Verify soft delete in database (check if we can access audit which shows deleted_at)
  process.stdout.write('\n=== STEP 8: Verify soft delete ===\n');
  // The transaction shouldn't show in normal list but should still exist in the database
  // Check audit log which should show a 'deleted' action
  const auditRes = await api('GET', '/api/transactions/' + txId + '/audit', null, token);
  process.stdout.write('Audit endpoint status: ' + auditRes.status + '\n');
  if (auditRes.status === 200) {
    const auditEntries = auditRes.data.auditLog || auditRes.data.audit || auditRes.data;
    process.stdout.write('Audit entries: ' + (Array.isArray(auditEntries) ? auditEntries.length : 'N/A') + '\n');
    if (Array.isArray(auditEntries)) {
      auditEntries.forEach((entry, i) => {
        process.stdout.write('  ' + (i+1) + ': action=' + entry.action + ' user=' + entry.user_id + ' at=' + entry.created_at + '\n');
        if (entry.changes) {
          try {
            const changes = typeof entry.changes === 'string' ? JSON.parse(entry.changes) : entry.changes;
            process.stdout.write('     changes: ' + JSON.stringify(changes).substring(0, 100) + '\n');
          } catch(e) {
            process.stdout.write('     changes: ' + String(entry.changes).substring(0, 100) + '\n');
          }
        }
      });
    }
  } else {
    process.stdout.write('Audit data: ' + JSON.stringify(auditRes.data) + '\n');
  }

  // Summary
  process.stdout.write('\n========== SUMMARY ==========\n');
  process.stdout.write('Income created: ' + (createRes.status === 201 || createRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Found in list: ' + (found ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Edit successful: ' + (editRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Edit metadata present: ' + (edited && edited.edited_by ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Delete successful: ' + (deleteRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Not in list after delete: ' + (!stillExists ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Audit log accessible: ' + (auditRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
}

main().catch(e => process.stderr.write(e.message + '\n'));
