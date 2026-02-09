const { execSync } = require('child_process');

// Find and kill node processes on port 3001
try {
  // Use netstat on Windows to find the PID
  const output = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  const lines = output.trim().split('\n');
  const pids = new Set();
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });
  pids.forEach(pid => {
    try {
      process.kill(parseInt(pid));
      console.log('Killed PID:', pid);
    } catch(e) {
      console.log('Could not kill PID:', pid, e.message);
    }
  });
} catch(e) {
  console.log('No process found on port 3001 or error:', e.message);
}

console.log('Backend stopped. Waiting 2 seconds...');
setTimeout(() => {
  console.log('Done. Start backend manually.');
}, 2000);
