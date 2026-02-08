const { execSync } = require('child_process');

// Use Windows native commands to find and kill processes on port 3001
try {
  const result = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = result.split('\n').filter(l => l.includes(':3001') && l.includes('LISTENING'));
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }

  for (const pid of pids) {
    console.log('Killing PID:', pid);
    try {
      execSync('cmd /c "taskkill /F /PID ' + pid + '"', { encoding: 'utf8' });
      console.log('Killed', pid);
    } catch(e) {
      console.log('Failed to kill', pid, ':', e.stderr || e.message);
    }
  }
} catch(e) {
  console.log('Error:', e.message);
}
