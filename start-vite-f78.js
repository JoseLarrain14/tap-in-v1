const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const child = spawn('npx', ['vite', '--host', '--port', '5173'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  process.stderr.write('Error: ' + err.message + '\n');
});

process.on('SIGTERM', () => child.kill());
process.on('SIGINT', () => child.kill());
