const { spawn } = require('child_process');

// Start frontend
const frontend = spawn('npx', ['vite', '--host', '--port', '5173'], {
  cwd: 'C:/Users/josel/CPP/frontend',
  stdio: 'inherit',
  detached: true,
  shell: true
});
frontend.unref();
console.log('Frontend started, PID:', frontend.pid);
