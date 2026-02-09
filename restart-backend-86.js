var http = require('http');
var spawn = require('child_process').spawn;

function startBackend() {
  var p = spawn('node', ['src/index.js'], {
    cwd: 'C:/Users/josel/CPP/backend',
    stdio: 'ignore',
    detached: true,
    shell: true
  });
  p.unref();
  console.log('Backend started PID:', p.pid);
}

// Try to kill via API shutdown or just start fresh
var req = http.request({hostname: 'localhost', port: 3001, path: '/api/shutdown', method: 'POST', timeout: 2000}, function(res) {
  console.log('Shutdown response:', res.statusCode);
  setTimeout(startBackend, 1500);
  setTimeout(function() { process.exit(0); }, 5000);
});
req.on('error', function() {
  console.log('No existing backend, starting fresh...');
  startBackend();
  setTimeout(function() { process.exit(0); }, 5000);
});
req.end();
