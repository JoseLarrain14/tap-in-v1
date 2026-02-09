const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
console.log('Starting Vite from:', frontendDir);

const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '--port', '5173'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

vite.on('error', (err) => console.error('Failed:', err));
vite.on('close', (code) => console.log('Vite exited with code:', code));
