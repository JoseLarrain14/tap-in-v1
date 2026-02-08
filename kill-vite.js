const { execSync } = require('child_process');
const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
ports.forEach(port => {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
          console.log(`Killed PID ${pid} on port ${port}`);
        } catch(e) {}
      }
    });
  } catch(e) {}
});
console.log('Done cleaning up vite ports');
