const { execSync, spawn } = require('child_process');
const http = require('http');

// Kill any existing processes on port 5173
try {
  const result = execSync('netstat -ano | findstr :5173', { encoding: 'utf8', timeout: 5000 });
  const lines = result.trim().split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`kill ${pid}`, { timeout: 3000 });
      console.log(`Killed PID ${pid}`);
    } catch (e) {
      // ignore
    }
  }
} catch (e) {
  console.log('No existing process on 5173');
}

// Wait a bit
setTimeout(() => {
  // Start vite
  const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
    cwd: 'C:/Users/josel/CPP/frontend',
    stdio: 'inherit',
    detached: true,
    shell: true
  });
  vite.unref();
  console.log('Vite started with PID:', vite.pid);

  // Check if it's up after 5 seconds
  setTimeout(() => {
    http.get('http://localhost:5173', (res) => {
      console.log('Frontend responding, status:', res.statusCode);
      process.exit(0);
    }).on('error', (e) => {
      console.log('Frontend not responding yet:', e.message);
      process.exit(0);
    });
  }, 5000);
}, 2000);
