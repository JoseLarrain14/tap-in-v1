const { execSync } = require('child_process');

const ports = process.argv.slice(2);
if (ports.length === 0) {
  console.log('Usage: node kill-port-multi.js <port1> [port2] ...');
  process.exit(1);
}

const result = execSync('netstat -ano', { encoding: 'utf8' });
for (const port of ports) {
  const lines = result.split('\n').filter(l => l.includes(':' + port) && l.includes('LISTENING'));
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    console.log('Killing PID', pid, 'on port', port);
    try {
      execSync('cmd /c "taskkill /F /PID ' + pid + '"', { encoding: 'utf8' });
    } catch(e) { console.log('Failed:', e.message); }
  }
}
