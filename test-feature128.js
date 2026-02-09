// Test script for Feature #128: Reminder notification after 3 days
var http = require('http');

function apiCall(method, path, token, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : '';
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    var req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: headers
    }, function(res) {
      var chunks = [];
      res.on('data', function(d) { chunks.push(d); });
      res.on('end', function() {
        var responseBody = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch(e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  var action = process.argv[2] || 'full-test';

  // Step 1: Login as delegado
  console.log('=== Feature #128: Reminder notification after 3 days ===');
  console.log('');

  var delLogin = await apiCall('POST', '/api/auth/login', null, {email:'delegado@tapin.cl', password:'password123'});
  var delToken = delLogin.data.token;
  console.log('1. Logged in as delegado');

  var presLogin = await apiCall('POST', '/api/auth/login', null, {email:'presidente@tapin.cl', password:'password123'});
  var presToken = presLogin.data.token;
  var presUserId = presLogin.data.user.id;
  console.log('2. Logged in as presidente (id=' + presUserId + ')');

  // Step 2: Create and submit a payment request
  var prCreate = await apiCall('POST', '/api/payment-requests', delToken, {
    amount: 55000,
    description: 'FEAT128_REMINDER_TEST_' + Date.now(),
    beneficiary: 'Test Beneficiary F128',
    status: 'pendiente'
  });
  console.log('3. Created payment request #' + prCreate.data.id + ' status=' + prCreate.data.status);
  var prId = prCreate.data.id;

  // Step 3: Simulate 3 days passing by updating the updated_at timestamp
  // We need a direct DB manipulation for this - use a special endpoint or SQL
  // Let's call the debug endpoint to modify the timestamp
  console.log('4. Need to simulate 3 days passing...');
  console.log('   Will use debug/check-reminders endpoint after DB adjustment');

  // Output the PR ID so we can manipulate the DB
  console.log('PR_ID=' + prId);
  console.log('PRES_TOKEN=' + presToken);
  console.log('PRES_USER_ID=' + presUserId);
  console.log('DEL_TOKEN=' + delToken);
}

async function checkReminders() {
  var result = await apiCall('POST', '/api/debug/check-reminders', null, null);
  console.log('Check reminders result:', JSON.stringify(result.data));
}

async function checkNotifications() {
  var presLogin = await apiCall('POST', '/api/auth/login', null, {email:'presidente@tapin.cl', password:'password123'});
  var presToken = presLogin.data.token;

  var result = await apiCall('GET', '/api/notifications?is_read=false', presToken, null);
  console.log('Presidente unread notifications: ' + result.data.unread_count);
  result.data.notifications.forEach(function(n) {
    if (n.type === 'recordatorio') {
      console.log('  [RECORDATORIO] #' + n.id + ': ' + n.title + ' - ' + n.message);
      console.log('    reference_type=' + n.reference_type + ' reference_id=' + n.reference_id);
    }
  });
}

var action = process.argv[2] || 'create';
if (action === 'create') {
  main().catch(function(e) { console.error(e); process.exit(1); });
} else if (action === 'check-reminders') {
  checkReminders().catch(function(e) { console.error(e); process.exit(1); });
} else if (action === 'check-notifications') {
  checkNotifications().catch(function(e) { console.error(e); process.exit(1); });
}
