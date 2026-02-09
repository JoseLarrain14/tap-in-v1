const { execSync } = require('child_process');
const { spawn } = require('child_process');
const http = require('http');

// Kill backend on port 3001
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
    try { execSync(`taskkill /F /PID ${p}`, { stdio: 'ignore' }); } catch(e) {}
  });
  console.log('Killed old backend');
} catch(e) {
  console.log('No existing backend to kill');
}

setTimeout(() => {
  const child = spawn('node', ['src/index.js'], {
    cwd: 'C:/Users/josel/CPP/backend',
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore']
  });
  child.unref();
  console.log('Started new backend, PID:', child.pid);

  // Wait for it to be ready
  let attempts = 0;
  const check = () => {
    attempts++;
    http.get('http://localhost:3001/api/health', res => {
      console.log('Backend ready after', attempts, 'attempts');
    }).on('error', () => {
      if (attempts < 30) setTimeout(check, 1000);
      else console.log('Backend failed to start');
    });
  };
  setTimeout(check, 2000);
}, 1000);
