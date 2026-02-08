const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const child = spawn('npx', ['vite', '--port', '5180'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true,
  detached: false
});

child.on('error', (err) => {
  console.error('Failed to start:', err.message);
});

// Keep process alive
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit(0);
});
