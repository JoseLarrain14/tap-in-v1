// Simulate aging and verify reminder for Feature #128
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
  var action = process.argv[2] || 'simulate';

  if (action === 'simulate') {
    // Step 1: Simulate 4 days passing for PR #51
    console.log('Step 1: Simulating 4 days aging for PR #51...');
    var ageResult = await apiCall('POST', '/api/debug/schema/simulate-age', null, {
      payment_request_id: 51,
      days_ago: 4
    });
    console.log('  Result:', JSON.stringify(ageResult.data));

    // Step 2: Trigger the reminder check
    console.log('Step 2: Triggering reminder check...');
    var reminderResult = await apiCall('POST', '/api/debug/check-reminders', null, null);
    console.log('  Result:', JSON.stringify(reminderResult.data));

    // Step 3: Check presidente's notifications for recordatorio type
    console.log('Step 3: Checking presidente notifications...');
    var presLogin = await apiCall('POST', '/api/auth/login', null, {email:'presidente@tapin.cl', password:'password123'});
    var presToken = presLogin.data.token;

    var notifs = await apiCall('GET', '/api/notifications', presToken, null);
    var recordatorios = notifs.data.notifications.filter(function(n) { return n.type === 'recordatorio'; });
    console.log('  Total notifications: ' + notifs.data.pagination.total);
    console.log('  Recordatorio notifications: ' + recordatorios.length);
    recordatorios.forEach(function(n) {
      console.log('    [RECORDATORIO] #' + n.id + ': ' + n.title);
      console.log('      Message: ' + n.message);
      console.log('      reference_type=' + n.reference_type + ' reference_id=' + n.reference_id);
      console.log('      is_read=' + n.is_read);
    });

    // Verify the specific reminder for PR #51
    var pr51Reminder = recordatorios.filter(function(n) { return n.reference_id === 51; });
    if (pr51Reminder.length > 0) {
      console.log('\n=== VERIFICATION PASSED ===');
      console.log('  Reminder notification created for PR #51');
      console.log('  Type: ' + pr51Reminder[0].type + ' (expected: recordatorio)');
      console.log('  Targets presidente user_id: ' + presLogin.data.user.id);
      console.log('  REMINDER_ID=' + pr51Reminder[0].id);
    } else {
      console.log('\n=== VERIFICATION FAILED ===');
      console.log('  No recordatorio notification found for PR #51');
    }
  }

  if (action === 'no-duplicate') {
    // Verify running check again doesn't create duplicate reminders
    console.log('Checking for duplicate prevention...');
    var reminderResult = await apiCall('POST', '/api/debug/check-reminders', null, null);
    console.log('  Result:', JSON.stringify(reminderResult.data));
    if (reminderResult.data.reminders_created === 0) {
      console.log('  PASSED: No duplicate reminders created');
    } else {
      console.log('  FAILED: Duplicate reminders created!');
    }
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
