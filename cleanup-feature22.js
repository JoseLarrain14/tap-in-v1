const http = require('http');

function apiRequest(method, urlPath, body, token) {
  return new Promise(function(resolve, reject) {
    var url = new URL(urlPath, 'http://localhost:3001');
    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    var req = http.request(options, function(res) {
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
  // Login as presidente
  var login = await apiRequest('POST', '/api/auth/login', { email: 'presidente@tapin.cl', password: 'password123' });
  var token = login.body.token;

  // Get all users
  var users = await apiRequest('GET', '/api/users', null, token);
  var usersList = users.body.users || [];

  // Re-activate any deactivated users
  for (var i = 0; i < usersList.length; i++) {
    var u = usersList[i];
    if (!u.is_active && u.id !== 1) {
      console.log('Re-activating:', u.name, '(' + u.email + ')');
      var result = await apiRequest('PUT', '/api/users/' + u.id + '/activate', {}, token);
      console.log('  Status:', result.status, '- Active:', result.body.user ? result.body.user.is_active : 'N/A');
    }
  }

  // Verify all users are now active
  var after = await apiRequest('GET', '/api/users', null, token);
  var afterList = after.body.users || [];
  console.log('\nFinal user states:');
  afterList.forEach(function(u) {
    console.log('  ' + u.name + ' (' + u.email + ') - Active: ' + u.is_active);
  });
}

main().catch(function(err) { console.error('Error:', err.message); });
