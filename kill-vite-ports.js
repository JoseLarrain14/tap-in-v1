const { execSync } = require('child_process');

// Kill all processes on Vite ports (5173, 5180-5183)
const portsToKill = [5173, 5180, 5181, 5182, 5183];

try {
  const result = execSync('netstat -ano', { encoding: 'utf8' });
  const pids = new Set();

  for (const port of portsToKill) {
    const lines = result.split('\n').filter(l => l.includes(':' + port) && l.includes('LISTENING'));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
  }

  console.log('Found PIDs to kill:', [...pids]);
  for (const pid of pids) {
    try {
      execSync('cmd /c "taskkill /F /PID ' + pid + '"', { encoding: 'utf8' });
      console.log('Killed PID', pid);
    } catch(e) {
      console.log('Failed to kill PID', pid);
    }
  }
  console.log('Done. All Vite ports should be free now.');
} catch(e) {
  console.log('Error:', e.message);
}
