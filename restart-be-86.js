var http = require('http');
var spawn = require('child_process').spawn;

// First kill the existing backend by hitting a force-restart
var req = http.request({hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET'}, function(res) {
  console.log('Backend is running, killing it...');
  // Start a new one
  var p = spawn('node', ['src/index.js'], {
    cwd: 'C:/Users/josel/CPP/backend',
    stdio: 'inherit',
    detached: true,
    shell: true
  });
  p.unref();
  console.log('New backend started with PID:', p.pid);
  setTimeout(function() { process.exit(0); }, 3000);
});
req.on('error', function(err) {
  console.log('Backend not running, starting fresh...');
  var p = spawn('node', ['src/index.js'], {
    cwd: 'C:/Users/josel/CPP/backend',
    stdio: 'inherit',
    detached: true,
    shell: true
  });
  p.unref();
  console.log('Backend started with PID:', p.pid);
  setTimeout(function() { process.exit(0); }, 3000);
});
req.end();
