const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const viteJs = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn('node', [viteJs, '--host', '--port', '5174', '--strictPort'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('error', (err) => {
  console.error('Failed to start vite:', err.message);
});

child.on('close', (code) => {
  console.log('Vite exited with code:', code);
});
