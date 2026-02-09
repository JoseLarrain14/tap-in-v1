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
  // Step 1: Login as delegado
  var delegadoLogin = await request('POST', '/api/auth/login', {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  var delegadoToken = delegadoLogin.body.token;
  var delegadoId = delegadoLogin.body.user.id;
  process.stdout.write('Delegado ID: ' + delegadoId + '\n');

  // Step 2: Login as presidente
  var presidenteLogin = await request('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  var presidenteToken = presidenteLogin.body.token;

  // Step 3: Get categories - debug the response
  var cats = await request('GET', '/api/categories?type=egreso', null, delegadoToken);
  process.stdout.write('Categories response: ' + JSON.stringify(cats.body).substring(0, 300) + '\n');

  // Handle different response formats
  var catList = Array.isArray(cats.body) ? cats.body : (cats.body.categories || cats.body.data || []);
  if (catList.length === 0) {
    process.stdout.write('ERROR: No egreso categories found\n');
    return;
  }
  var categoryId = catList[0].id;
  process.stdout.write('Category ID: ' + categoryId + '\n');

  // Step 4: Mark all delegado notifications as read
  await request('PUT', '/api/notifications/read-all', {}, delegadoToken);

  // Step 5: Create a payment request as delegado (borrador)
  var uniqueDesc = 'FEAT64_TEST_REJECTION_' + Date.now();
  var createRes = await request('POST', '/api/payment-requests', {
    description: uniqueDesc,
    amount: 50000,
    category_id: categoryId,
    beneficiary: 'Test Beneficiary FEAT64',
    justification: 'Testing rejection notification'
  }, delegadoToken);
  process.stdout.write('Created PR: status=' + createRes.status + ' id=' + (createRes.body.id || 'N/A') + '\n');
  if (createRes.status !== 201 && createRes.status !== 200) {
    process.stdout.write('Create error: ' + JSON.stringify(createRes.body) + '\n');
    return;
  }
  var prId = createRes.body.id;

  // Step 6: Submit the draft (change to pendiente)
  var submitRes = await request('POST', '/api/payment-requests/' + prId + '/submit', {}, delegadoToken);
  process.stdout.write('Submitted PR: status=' + submitRes.status + '\n');

  // Step 7: Reject as presidente with comment
  var rejectComment = 'Rechazado por presupuesto insuficiente - TEST_FEAT64';
  var rejectRes = await request('POST', '/api/payment-requests/' + prId + '/reject', {
    comment: rejectComment
  }, presidenteToken);
  process.stdout.write('Rejected PR: status=' + rejectRes.status + '\n');
  if (rejectRes.status !== 200) {
    process.stdout.write('Reject error: ' + JSON.stringify(rejectRes.body) + '\n');
  }

  // Step 8: Check delegado unread notifications
  var notifs = await request('GET', '/api/notifications', null, delegadoToken);
  process.stdout.write('Notifications response keys: ' + Object.keys(notifs.body).join(', ') + '\n');
  var notifList = notifs.body.notifications || notifs.body.data || (Array.isArray(notifs.body) ? notifs.body : []);

  // Find the rejection notification
  var rejectionNotif = notifList.find(function(n) {
    return n.type === 'solicitud_rechazada' && n.message && n.message.indexOf('FEAT64') !== -1;
  });

  if (rejectionNotif) {
    process.stdout.write('\n=== REJECTION NOTIFICATION FOUND ===\n');
    process.stdout.write('Type: ' + rejectionNotif.type + '\n');
    process.stdout.write('Title: ' + rejectionNotif.title + '\n');
    process.stdout.write('Message: ' + rejectionNotif.message + '\n');
    process.stdout.write('Reference type: ' + rejectionNotif.reference_type + '\n');
    process.stdout.write('Reference id: ' + rejectionNotif.reference_id + '\n');
    process.stdout.write('Has rejection comment: ' + (rejectionNotif.message.indexOf(rejectComment) !== -1) + '\n');
    process.stdout.write('Is unread: ' + (!rejectionNotif.is_read) + '\n');
    process.stdout.write('PR ID matches: ' + (rejectionNotif.reference_id == prId) + '\n');
    process.stdout.write('\n=== ALL CHECKS PASSED ===\n');
  } else {
    process.stdout.write('\n=== REJECTION NOTIFICATION NOT FOUND ===\n');
    process.stdout.write('All notifications (' + notifList.length + '):\n');
    notifList.forEach(function(n) {
      process.stdout.write('  - [' + n.type + '] ' + (n.message || '').substring(0, 100) + '\n');
    });
  }
}

main().catch(function(e) { process.stdout.write('Error: ' + e.message + '\n'); });
