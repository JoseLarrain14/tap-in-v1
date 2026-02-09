const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const child = spawn('npx', ['vite', '--host'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => console.error('Failed to start:', err));
child.on('exit', (code) => console.log('Vite exited with code:', code));
