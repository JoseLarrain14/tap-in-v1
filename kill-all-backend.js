const { execSync } = require('child_process');

// Kill all processes on port 3001
for (let i = 0; i < 3; i++) {
  try {
    const result = execSync('netstat -ano', { encoding: 'utf8' });
    const lines = result.split('\n').filter(l => l.includes(':3001') && l.includes('LISTENING'));
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    if (pids.size === 0) {
      console.log('No processes on port 3001');
      break;
    }
    for (const pid of pids) {
      console.log('Killing PID:', pid);
      try {
        execSync('cmd /c "taskkill /F /PID ' + pid + ' /T"', { encoding: 'utf8' });
      } catch(e) { /* ignore */ }
    }
  } catch(e) { /* ignore */ }
  // Wait a bit
  execSync('timeout /t 2 /nobreak >nul 2>&1 || sleep 2', { stdio: 'pipe' });
}
console.log('Done');
