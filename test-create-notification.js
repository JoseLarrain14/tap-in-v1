var http = require('http');

function makeRequest(opts, body) {
  return new Promise(function(resolve, reject) {
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() { resolve({ status: res.statusCode, body: JSON.parse(data) }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // Step 1: Get presidente token
  var authData = JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' });
  var authRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': authData.length }
  }, authData);
  var token = authRes.body.token;
  var userId = authRes.body.user.id;
  console.log('Logged in as presidente, user id:', userId);

  // Step 2: Create a test notification for this user
  var notifData = JSON.stringify({
    user_id: userId,
    type: 'recordatorio',
    title: 'Recordatorio de prueba',
    message: 'FEATURE41_TEST_NOTIFICATION - Esta es una notificacion de prueba'
  });
  var notifRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/notifications', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': notifData.length, 'Authorization': 'Bearer ' + token }
  }, notifData);
  console.log('Created notification:', notifRes.status, JSON.stringify(notifRes.body));

  // Step 3: Check unread count
  var countRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/notifications/unread-count',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Unread count after creating notification:', JSON.stringify(countRes.body));
}

run().catch(function(e) { console.error('Error:', e); process.exit(1); });
