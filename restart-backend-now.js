// Restart backend by killing existing process and starting new one
const { execSync, spawn } = require('child_process');
const http = require('http');

// Find and kill existing backend on port 3001
try {
  const result = execSync('wmic process where "commandline like \'%backend%src%index.js%\'" get processid /format:csv', { encoding: 'utf-8' });
  const lines = result.trim().split('\n').filter(l => l.trim());
  for (const line of lines) {
    const parts = line.trim().split(',');
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid) && parseInt(pid) > 0) {
      try {
        process.kill(parseInt(pid), 'SIGTERM');
        console.log('Killed backend PID:', pid);
      } catch (e) {}
    }
  }
} catch (e) {
  console.log('Could not find backend process via wmic, trying alternative...');
}

// Also try to kill by port
try {
  const netstat = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf-8' });
  const lines = netstat.trim().split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid) && parseInt(pid) > 0) {
      try {
        process.kill(parseInt(pid), 'SIGTERM');
        console.log('Killed process on port 3001, PID:', pid);
      } catch (e) {}
    }
  }
} catch (e) {
  console.log('No process found on port 3001');
}

// Wait a moment then start backend
setTimeout(() => {
  console.log('Starting backend...');
  const child = spawn('node', ['src/index.js'], {
    cwd: require('path').join(__dirname, 'backend'),
    stdio: 'inherit',
    detached: true
  });
  child.unref();

  // Wait for it to be ready
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    const req = http.get('http://localhost:3001/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Backend ready!', data.substring(0, 50));
        clearInterval(check);
        process.exit(0);
      });
    });
    req.on('error', () => {
      if (attempts > 30) {
        console.log('Backend failed to start');
        clearInterval(check);
        process.exit(1);
      }
    });
  }, 1000);
}, 2000);
