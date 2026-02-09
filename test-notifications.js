// Test script for notification features
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
  var action = process.argv[2] || 'get-tokens';

  if (action === 'get-tokens') {
    // Get tokens for both users
    var presLogin = await apiCall('POST', '/api/auth/login', null, {email:'presidente@tapin.cl', password:'password123'});
    var delLogin = await apiCall('POST', '/api/auth/login', null, {email:'delegado@tapin.cl', password:'password123'});
    console.log('PRESIDENTE_TOKEN=' + presLogin.data.token);
    console.log('DELEGADO_TOKEN=' + delLogin.data.token);
    console.log('PRESIDENTE_ID=' + presLogin.data.user.id);
    console.log('DELEGADO_ID=' + delLogin.data.user.id);
  }

  if (action === 'get-unread') {
    var token = process.argv[3];
    var result = await apiCall('GET', '/api/notifications/unread-count', token);
    console.log('UNREAD_COUNT=' + result.data.unread_count);
  }

  if (action === 'create-notification') {
    // As presidente, create a notification for delegado (user_id=3)
    var token = process.argv[3];
    var targetUserId = parseInt(process.argv[4]);
    var result = await apiCall('POST', '/api/notifications', token, {
      user_id: targetUserId,
      type: 'solicitud_aprobada',
      title: 'TEST_NOTIF_127 - Solicitud aprobada',
      message: 'Tu solicitud de prueba ha sido aprobada para verificar el badge en tiempo real',
      reference_type: 'payment_request',
      reference_id: 1
    });
    console.log('CREATED_STATUS=' + result.status);
    console.log('CREATED_ID=' + (result.data.id || 'none'));
    console.log(JSON.stringify(result.data));
  }

  if (action === 'mark-read') {
    var token = process.argv[3];
    var notifId = process.argv[4];
    var result = await apiCall('PUT', '/api/notifications/' + notifId + '/read', token);
    console.log('MARK_READ_STATUS=' + result.status);
    console.log(JSON.stringify(result.data));
  }

  if (action === 'get-notifications') {
    var token = process.argv[3];
    var result = await apiCall('GET', '/api/notifications', token);
    console.log('TOTAL=' + result.data.pagination.total);
    console.log('UNREAD=' + result.data.unread_count);
    result.data.notifications.forEach(function(n) {
      console.log('  [' + (n.is_read ? 'READ' : 'UNREAD') + '] #' + n.id + ' ' + n.type + ': ' + n.title);
    });
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
