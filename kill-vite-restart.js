const { execSync, spawn } = require('child_process');
const path = require('path');

// Kill all node processes listening on 5173-5180
try {
  const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
  // Just kill specific ports
  for (let port = 5173; port <= 5180; port++) {
    try {
      const pid = execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do @echo %a`, { encoding: 'utf8', shell: true }).trim();
      if (pid && pid !== '0') {
        try { execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' }); } catch(e) {}
        process.stdout.write('Killed PID ' + pid + ' on port ' + port + '\n');
      }
    } catch(e) {}
  }
} catch(e) {
  process.stdout.write('Error killing: ' + e.message + '\n');
}

// Wait a moment then start fresh vite
setTimeout(() => {
  const frontendDir = path.join(__dirname, 'frontend');
  const child = spawn('npx', ['vite', '--host', '--port', '5173'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true
  });
  child.on('error', err => process.stderr.write('Error: ' + err.message + '\n'));
  process.on('SIGTERM', () => child.kill());
  process.on('SIGINT', () => child.kill());
}, 2000);
