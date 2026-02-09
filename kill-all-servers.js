const { execSync } = require('child_process');

// Kill all processes on ports 3001, 5173-5177
const ports = [3001, 5173, 5174, 5175, 5176, 5177];
for (const port of ports) {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
        console.log(`Killed PID ${pid} on port ${port}`);
      } catch(e) {
        // Already killed
      }
    }
  } catch(e) {
    // No process on this port
  }
}
console.log('All server ports cleared');
