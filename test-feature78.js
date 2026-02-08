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

  // Step 1: Login as Presidente
  process.stdout.write('=== STEP 1: Login as Presidente ===\n');
  const login = await api('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  const token = login.data.token;
  process.stdout.write('Login: ' + (login.status === 200 ? 'OK' : 'FAIL') + '\n');

  // Step 2: Create new egreso category: Capacitacion
  process.stdout.write('\n=== STEP 2: Create egreso category ===\n');
  const createRes = await api('POST', '/api/categories', {
    name: 'Capacitacion_' + TS,
    type: 'egreso'
  }, token);
  process.stdout.write('Create status: ' + createRes.status + '\n');
  const catId = createRes.data.id || createRes.data.category?.id;
  process.stdout.write('Category ID: ' + catId + '\n');
  if (!catId) {
    process.stdout.write('ERROR: ' + JSON.stringify(createRes.data) + '\n');
    return;
  }

  // Step 3: Verify it appears in category list
  process.stdout.write('\n=== STEP 3: Verify in list ===\n');
  const listRes = await api('GET', '/api/categories', null, token);
  const cats = listRes.data.categories || listRes.data;
  const found = Array.isArray(cats) ? cats.find(c => c.id === catId) : null;
  process.stdout.write('Found in list: ' + (found ? 'YES' : 'NO') + '\n');
  if (found) {
    process.stdout.write('  Name: ' + found.name + '\n');
    process.stdout.write('  Type: ' + found.type + '\n');
  }

  // Step 4: Edit category name to Formacion
  process.stdout.write('\n=== STEP 4: Edit category ===\n');
  const editRes = await api('PUT', '/api/categories/' + catId, {
    name: 'Formacion_' + TS
  }, token);
  process.stdout.write('Edit status: ' + editRes.status + ' ' + (editRes.status === 200 ? 'OK' : 'FAIL') + '\n');

  // Step 5: Verify name updated
  process.stdout.write('\n=== STEP 5: Verify name updated ===\n');
  const afterEdit = await api('GET', '/api/categories/' + catId, null, token);
  const editedCat = afterEdit.data.category || afterEdit.data;
  process.stdout.write('Name after edit: ' + (editedCat.name || editedCat) + '\n');
  const nameUpdated = editedCat.name && editedCat.name.startsWith('Formacion_');
  process.stdout.write('Name correctly updated: ' + (nameUpdated ? 'YES' : 'NO') + '\n');

  // Also check the list endpoint
  const listAfterEdit = await api('GET', '/api/categories', null, token);
  const catsAfterEdit = listAfterEdit.data.categories || listAfterEdit.data;
  const foundEdited = Array.isArray(catsAfterEdit) ? catsAfterEdit.find(c => c.id === catId) : null;
  if (foundEdited) {
    process.stdout.write('  Name in list: ' + foundEdited.name + '\n');
  }

  // Step 6: Delete the category (no transactions)
  process.stdout.write('\n=== STEP 6: Delete category ===\n');
  const deleteRes = await api('DELETE', '/api/categories/' + catId, null, token);
  process.stdout.write('Delete status: ' + deleteRes.status + ' ' + (deleteRes.status === 200 ? 'OK' : 'FAIL') + '\n');
  if (deleteRes.status !== 200) {
    process.stdout.write('Delete error: ' + JSON.stringify(deleteRes.data) + '\n');
  }

  // Step 7: Verify category removed from list
  process.stdout.write('\n=== STEP 7: Verify removed from list ===\n');
  const listAfterDelete = await api('GET', '/api/categories', null, token);
  const catsAfterDelete = listAfterDelete.data.categories || listAfterDelete.data;
  const stillExists = Array.isArray(catsAfterDelete) ? catsAfterDelete.find(c => c.id === catId) : null;
  process.stdout.write('Still in list: ' + (stillExists ? 'YES - FAIL' : 'NO - PASS (correctly removed)') + '\n');

  // Step 8: Verify deleted from database (try to get by id)
  process.stdout.write('\n=== STEP 8: Verify deleted from database ===\n');
  const getDeleted = await api('GET', '/api/categories/' + catId, null, token);
  process.stdout.write('Get deleted category status: ' + getDeleted.status + '\n');
  process.stdout.write('Response: ' + JSON.stringify(getDeleted.data) + '\n');
  const isGone = getDeleted.status === 404 || (getDeleted.data && getDeleted.data.error);
  process.stdout.write('Category gone from DB: ' + (isGone ? 'PASS' : 'Still accessible - check') + '\n');

  // Summary
  process.stdout.write('\n========== SUMMARY ==========\n');
  process.stdout.write('Category created: ' + (createRes.status === 201 || createRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Found in list: ' + (found ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Edit successful: ' + (editRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Name updated: ' + (nameUpdated ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Delete successful: ' + (deleteRes.status === 200 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Not in list after delete: ' + (!stillExists ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Deleted from database: ' + (isGone ? 'PASS' : 'FAIL') + '\n');
}

main().catch(e => process.stderr.write(e.message + '\n'));
