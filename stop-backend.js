const { execSync } = require('child_process');

try {
  const pid = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  const lines = pid.trim().split('\n');
  const pids = new Set();
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const p = parts[parts.length - 1];
    if (p && !isNaN(p)) pids.add(p);
  });
  pids.forEach(p => {
    try { execSync('taskkill /F /PID ' + p, { stdio: 'ignore' }); } catch(e) {}
  });
  process.stdout.write('Backend stopped (killed ' + pids.size + ' processes)\n');
} catch(e) {
  process.stdout.write('No backend found on port 3001\n');
}
