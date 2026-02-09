var http = require('http');

function post(url, data, cb) {
  var parsed = new URL(url);
  var postData = JSON.stringify(data);
  var req = http.request({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, function(res) {
    var body = '';
    res.on('data', function(d) { body += d; });
    res.on('end', function() { cb(null, JSON.parse(body)); });
  });
  req.on('error', function(e) { cb(e); });
  req.write(postData);
  req.end();
}

function get(url, token, cb) {
  var parsed = new URL(url);
  var req = http.request({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  }, function(res) {
    var body = '';
    res.on('data', function(d) { body += d; });
    res.on('end', function() { cb(null, JSON.parse(body)); });
  });
  req.on('error', function(e) { cb(e); });
  req.end();
}

post('http://localhost:3001/api/auth/login', {
  email: 'presidente@tapin.cl',
  password: 'password123'
}, function(err, login) {
  if (err) { process.stderr.write('Login error: ' + err.message + '\n'); process.exit(1); }
  var token = login.token;
  get('http://localhost:3001/api/transactions?limit=200', token, function(err2, data) {
    if (err2) { process.stderr.write('Get error: ' + err2.message + '\n'); process.exit(1); }
    var txs = data.transactions || [];
    var orphans = txs.filter(function(t) { return t.description && t.description.indexOf('REFRESH_TEST_131') >= 0; });
    process.stdout.write('Orphan records with REFRESH_TEST_131: ' + orphans.length + '\n');
    process.stdout.write('Total transactions: ' + txs.length + '\n');
    if (orphans.length > 0) {
      process.stdout.write('FAIL: Found orphan records!\n');
    } else {
      process.stdout.write('PASS: No orphan records found in database\n');
    }
  });
});
