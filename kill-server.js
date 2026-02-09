const { execSync } = require('child_process');
try {
  const result = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  const lines = result.trim().split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    console.log('Killing PID:', pid);
    try { execSync('taskkill /F /PID ' + pid, { encoding: 'utf8' }); console.log('Killed:', pid); } catch(e) { console.log('Kill error:', e.message); }
  }
  if (pids.size === 0) console.log('No process found on port 3001');
} catch(e) {
  console.log('No LISTENING process on port 3001 or error:', e.message);
}
