var spawn = require('child_process').spawn;
var p = spawn('npx', ['vite', '--host', '--port', '5173'], {
  cwd: 'C:/Users/josel/CPP/frontend',
  stdio: 'inherit',
  detached: true,
  shell: true
});
p.unref();
console.log('Started vite with PID:', p.pid);
setTimeout(function() { process.exit(0); }, 2000);
