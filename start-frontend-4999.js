const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const child = spawn('npx', ['vite', '--port', '4999', '--host', '0.0.0.0', '--strictPort'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

child.on('error', (err) => {
  console.error('Failed to start vite:', err);
});

child.on('close', (code) => {
  console.log('Vite exited with code:', code);
});
