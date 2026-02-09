var http = require('http');

function request(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  var ts = Date.now();

  // Login all three users
  var delegadoLogin = await request('POST', '/api/auth/login', {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  var delegadoToken = delegadoLogin.body.token;
  var delegadoId = delegadoLogin.body.user.id;

  var presidenteLogin = await request('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  var presidenteToken = presidenteLogin.body.token;
  var presidenteId = presidenteLogin.body.user.id;

  var secretariaLogin = await request('POST', '/api/auth/login', {
    email: 'secretaria@tapin.cl', password: 'password123'
  });
  var secretariaToken = secretariaLogin.body.token;

  process.stdout.write('Delegado ID: ' + delegadoId + ', Presidente ID: ' + presidenteId + '\n');

  // Get category
  var cats = await request('GET', '/api/categories?type=egreso', null, delegadoToken);
  var catList = cats.body.categories || [];
  var categoryId = catList[0].id;

  // Mark all notifications as read for both users
  await request('PUT', '/api/notifications/read-all', {}, delegadoToken);
  await request('PUT', '/api/notifications/read-all', {}, presidenteToken);

  // Step 1: Create payment request as delegado
  var desc = 'FEAT65_EXEC_TEST_' + ts;
  var createRes = await request('POST', '/api/payment-requests', {
    description: desc,
    amount: 75000,
    category_id: categoryId,
    beneficiary: 'Test Vendor FEAT65',
    justification: 'Testing execution notification'
  }, delegadoToken);
  var prId = createRes.body.id;
  process.stdout.write('Created PR #' + prId + ': ' + desc + '\n');

  // Step 2: Submit it
  var submitRes = await request('POST', '/api/payment-requests/' + prId + '/submit', {}, delegadoToken);
  process.stdout.write('Submitted: status=' + submitRes.status + '\n');

  // Step 3: Approve as presidente
  var approveRes = await request('POST', '/api/payment-requests/' + prId + '/approve', {
    comment: 'Aprobado para test'
  }, presidenteToken);
  process.stdout.write('Approved: status=' + approveRes.status + '\n');

  // Mark all as read again (to isolate execution notifications)
  await request('PUT', '/api/notifications/read-all', {}, delegadoToken);
  await request('PUT', '/api/notifications/read-all', {}, presidenteToken);

  // Step 4: Execute as secretaria
  var execRes = await request('POST', '/api/payment-requests/' + prId + '/execute', {
    comment: 'Pago ejecutado via transferencia'
  }, secretariaToken);
  process.stdout.write('Executed: status=' + execRes.status + '\n');
  if (execRes.status !== 200) {
    process.stdout.write('Execute error: ' + JSON.stringify(execRes.body) + '\n');
    return;
  }

  // Step 5: Check delegado notifications
  var delegadoNotifs = await request('GET', '/api/notifications', null, delegadoToken);
  var dNotifList = delegadoNotifs.body.notifications || [];
  var delegadoExecNotif = dNotifList.find(function(n) {
    return n.type === 'solicitud_ejecutada' && n.is_read === 0 && n.message.indexOf('FEAT65') !== -1;
  });

  // Step 6: Check presidente notifications
  var presidenteNotifs = await request('GET', '/api/notifications', null, presidenteToken);
  var pNotifList = presidenteNotifs.body.notifications || [];
  var presidenteExecNotif = pNotifList.find(function(n) {
    return n.type === 'solicitud_ejecutada' && n.is_read === 0 && n.message.indexOf('FEAT65') !== -1;
  });

  // Report results
  process.stdout.write('\n=== DELEGADO EXECUTION NOTIFICATION ===\n');
  if (delegadoExecNotif) {
    process.stdout.write('FOUND: ' + delegadoExecNotif.message + '\n');
    process.stdout.write('Reference: ' + delegadoExecNotif.reference_type + ' #' + delegadoExecNotif.reference_id + '\n');
    process.stdout.write('PR ID matches: ' + (delegadoExecNotif.reference_id == prId) + '\n');
  } else {
    process.stdout.write('NOT FOUND!\n');
    process.stdout.write('All delegado unread notifs:\n');
    dNotifList.filter(function(n) { return n.is_read === 0; }).forEach(function(n) {
      process.stdout.write('  - [' + n.type + '] ' + n.message + '\n');
    });
  }

  process.stdout.write('\n=== PRESIDENTE EXECUTION NOTIFICATION ===\n');
  if (presidenteExecNotif) {
    process.stdout.write('FOUND: ' + presidenteExecNotif.message + '\n');
    process.stdout.write('Reference: ' + presidenteExecNotif.reference_type + ' #' + presidenteExecNotif.reference_id + '\n');
    process.stdout.write('PR ID matches: ' + (presidenteExecNotif.reference_id == prId) + '\n');
  } else {
    process.stdout.write('NOT FOUND!\n');
    process.stdout.write('All presidente unread notifs:\n');
    pNotifList.filter(function(n) { return n.is_read === 0; }).forEach(function(n) {
      process.stdout.write('  - [' + n.type + '] ' + n.message + '\n');
    });
  }

  if (delegadoExecNotif && presidenteExecNotif) {
    process.stdout.write('\n=== ALL CHECKS PASSED ===\n');
  }
}

main().catch(function(e) { process.stdout.write('Error: ' + e.message + '\n'); });
