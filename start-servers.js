const { spawn, execSync } = require('child_process');

// Kill any existing vite on port 5173
try {
  const pids = execSync('lsof -ti:5173').toString().trim().split('\n');
  pids.forEach(p => { try { process.kill(parseInt(p)); } catch(e){} });
  console.log('Killed existing vite on 5173');
} catch(e) {
  console.log('No existing process on 5173');
}

// Start vite from the frontend directory
const vite = spawn('npx', ['vite', '--host'], {
  cwd: 'C:/Users/josel/CPP/frontend',
  stdio: 'inherit',
  shell: true
});

vite.on('error', (err) => console.error('Failed to start vite:', err));
console.log('Starting Vite from frontend directory...');
