const { execSync } = require('child_process');

// Kill processes on ports 3001 and 5173
try {
  const result3001 = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  const lines3001 = result3001.trim().split('\n');
  for (const line of lines3001) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') {
      try { execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' }); console.log(`Killed PID ${pid} on port 3001`); } catch(e) {}
    }
  }
} catch(e) { console.log('No process on port 3001'); }

try {
  const result5173 = execSync('netstat -ano | findstr :5173 | findstr LISTENING', { encoding: 'utf8' });
  const lines5173 = result5173.trim().split('\n');
  for (const line of lines5173) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') {
      try { execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' }); console.log(`Killed PID ${pid} on port 5173`); } catch(e) {}
    }
  }
} catch(e) { console.log('No process on port 5173'); }

console.log('Done killing processes');
